import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import yaml from "js-yaml";
import {
  HERMES_MODEL_OPTIONS,
  getHermesModelOption,
  type HermesModelOption,
  type HermesModelOptionId,
} from "@/lib/hermes/models";

const DEFAULT_GATEWAY_PORT = 8642;
const DEFAULT_GATEWAY_KEY = "change-me-local-dev";

function hermesHomeDir() {
  return path.join(process.cwd(), ".hermes");
}

function hermesConfigPath() {
  return path.join(hermesHomeDir(), "config.yaml");
}

function hermesEnvPath() {
  return path.join(hermesHomeDir(), ".env");
}

function appEnvPath() {
  return path.join(process.cwd(), ".env");
}

export type GatewayModelSyncResult = {
  optionId: HermesModelOptionId;
  model: string;
  provider: string;
  configPath: string;
  routesEnsured: string[];
  gatewayReloaded: boolean;
  gatewayWarning?: string;
};

/**
 * Hermes API server looks up request `model` in
 * `platforms.api_server.extra.model_routes`. Missing routes (or a gateway
 * started before routes were written) fall back to config.yaml `model.default`.
 * Keep both the default and the full route table in sync with builder settings.
 */
export async function applyHermesGatewayModelPreference(optionId: string): Promise<GatewayModelSyncResult> {
  const option = getHermesModelOption(optionId);
  const routesEnsured = ensureHermesModelRoutesAndDefault(option);
  const gateway = await reloadHermesGatewayBestEffort();

  return {
    optionId: option.id,
    model: option.model,
    provider: resolveHermesRuntimeProvider(option),
    configPath: hermesConfigPath(),
    routesEnsured,
    gatewayReloaded: gateway.reloaded,
    gatewayWarning: gateway.warning,
  };
}

export function ensureHermesModelRoutesAndDefault(option: HermesModelOption) {
  const config = readHermesConfigObject();
  const runtimeProvider = resolveHermesRuntimeProvider(option);

  const modelSection =
    config.model && typeof config.model === "object" && !Array.isArray(config.model)
      ? ({ ...(config.model as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  modelSection.default = option.model;
  modelSection.provider = runtimeProvider;

  if (option.kind === "local") {
    modelSection.base_url = "http://127.0.0.1:8080/v1";
    if (!modelSection.api_key) {
      modelSection.api_key = "not-needed";
    }
  } else if (!modelSection.base_url) {
    modelSection.base_url = "https://openrouter.ai/api/v1";
  }

  config.model = modelSection;

  const platforms =
    config.platforms && typeof config.platforms === "object" && !Array.isArray(config.platforms)
      ? ({ ...(config.platforms as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const apiServer =
    platforms.api_server && typeof platforms.api_server === "object" && !Array.isArray(platforms.api_server)
      ? ({ ...(platforms.api_server as Record<string, unknown>) } as Record<string, unknown>)
      : { enabled: true };
  const extra =
    apiServer.extra && typeof apiServer.extra === "object" && !Array.isArray(apiServer.extra)
      ? ({ ...(apiServer.extra as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const routes =
    extra.model_routes && typeof extra.model_routes === "object" && !Array.isArray(extra.model_routes)
      ? ({ ...(extra.model_routes as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const ensured: string[] = [];

  for (const catalogOption of HERMES_MODEL_OPTIONS) {
    routes[catalogOption.model] = buildModelRoute(catalogOption);
    ensured.push(catalogOption.model);
  }

  // Alias by AppLoop option id for resilience.
  routes[option.id] = buildModelRoute(option);
  ensured.push(option.id);

  extra.model_routes = routes;
  apiServer.enabled = apiServer.enabled ?? true;
  apiServer.extra = extra;
  platforms.api_server = apiServer;
  config.platforms = platforms;

  writeHermesConfigObject(config);
  return ensured;
}

function buildModelRoute(option: HermesModelOption): Record<string, string> {
  if (option.kind === "local") {
    const home = process.env.HOME ?? "/Users/josoroma";
    return {
      model: `${home}/models/qwen/Qwen3.6-27B-OptiQ-4bit`,
      // Hermes resolves custom OpenAI-compatible backends via provider=custom.
      provider: "custom",
      base_url: "http://127.0.0.1:8080/v1",
      api_key: "not-needed",
    };
  }

  return {
    model: option.model,
    provider: "openrouter",
  };
}

function resolveHermesRuntimeProvider(option: HermesModelOption) {
  return option.kind === "local" ? "custom" : "openrouter";
}

function readHermesConfigObject(): Record<string, unknown> {
  fs.mkdirSync(hermesHomeDir(), { recursive: true });

  if (!fs.existsSync(hermesConfigPath())) {
    return {};
  }

  const raw = fs.readFileSync(hermesConfigPath(), "utf8");
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function writeHermesConfigObject(config: Record<string, unknown>) {
  const serialized = yaml.dump(config, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(hermesConfigPath(), serialized.endsWith("\n") ? serialized : `${serialized}\n`, "utf8");
}

async function reloadHermesGatewayBestEffort(): Promise<{ reloaded: boolean; warning?: string }> {
  try {
    const port = readGatewayPort();
    const key = readGatewayKey();
    await stopProcessOnPort(port);

    const child = spawn("hermes", ["gateway"], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        ...readEnvFile(appEnvPath()),
        ...readEnvFile(hermesEnvPath()),
        HERMES_HOME: hermesHomeDir(),
        API_SERVER_ENABLED: process.env.API_SERVER_ENABLED ?? "true",
        API_SERVER_KEY: process.env.API_SERVER_KEY ?? key,
        API_SERVER_PORT: String(port),
      },
    });
    child.unref();

    const ready = await waitForGateway(port, key, 20_000);
    if (!ready) {
      return {
        reloaded: false,
        warning: `Updated Hermes config, but gateway on :${port} did not become ready. Run \`make hermes-gateway\`.`,
      };
    }

    return { reloaded: true };
  } catch (error) {
    return {
      reloaded: false,
      warning: error instanceof Error ? error.message : "Failed to reload Hermes gateway.",
    };
  }
}

async function stopProcessOnPort(port: number) {
  let pids: string[] = [];
  try {
    pids = execFileSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Process may already be gone.
    }
  }

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      execFileSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      await sleep(200);
    } catch {
      break;
    }
  }
}

async function waitForGateway(port: number, key: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const body = execFileSync(
        "curl",
        ["-sS", "-H", `Authorization: Bearer ${key}`, `http://127.0.0.1:${port}/v1/models`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 2_000 },
      );
      if (body.includes("\"object\"") || body.includes("model")) {
        return true;
      }
    } catch {
      // keep waiting
    }
    await sleep(300);
  }

  return false;
}

function readGatewayPort() {
  const env = {
    ...readEnvFile(appEnvPath()),
    ...readEnvFile(hermesEnvPath()),
    ...process.env,
  };
  const value = Number(env.API_SERVER_PORT ?? env.HERMES_GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GATEWAY_PORT;
}

function readGatewayKey() {
  const env = {
    ...readEnvFile(appEnvPath()),
    ...readEnvFile(hermesEnvPath()),
    ...process.env,
  };
  return env.HERMES_API_KEY || env.API_SERVER_KEY || DEFAULT_GATEWAY_KEY;
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
