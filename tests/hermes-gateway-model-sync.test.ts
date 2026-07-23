import { describe, expect, it } from "vitest";
import { ensureHermesModelRoutesAndDefault } from "@/lib/hermes/gateway-model-sync";
import { getHermesModelOption } from "@/lib/hermes/models";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

describe("Hermes gateway model sync", () => {
  it("writes the preferred model as default and ensures route aliases", () => {
    const previousCwd = process.cwd();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "apploop-hermes-sync-"));

    try {
      process.chdir(tempRoot);
      fs.mkdirSync(path.join(tempRoot, ".hermes"), { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, ".hermes", "config.yaml"),
        yaml.dump({
          model: { default: "x-ai/grok-4.5", provider: "openrouter" },
          platforms: {
            api_server: {
              enabled: true,
              extra: {
                model_routes: {
                  "deepseek/deepseek-v4-pro": {
                    model: "deepseek/deepseek-v4-pro",
                    provider: "openrouter",
                  },
                },
              },
            },
          },
        }),
        "utf8",
      );

      const option = getHermesModelOption("nemotron-3-ultra-free");
      const ensured = ensureHermesModelRoutesAndDefault(option);
      const config = yaml.load(fs.readFileSync(path.join(tempRoot, ".hermes", "config.yaml"), "utf8")) as {
        model: { default: string; provider: string };
        platforms: { api_server: { extra: { model_routes: Record<string, { model: string; provider: string }> } } };
      };

      expect(config.model.default).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
      expect(config.model.provider).toBe("openrouter");
      expect(ensured).toContain("nvidia/nemotron-3-ultra-550b-a55b:free");
      expect(config.platforms.api_server.extra.model_routes["nvidia/nemotron-3-ultra-550b-a55b:free"]).toMatchObject({
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        provider: "openrouter",
      });
      expect(config.platforms.api_server.extra.model_routes["x-ai/grok-4.5"]).toMatchObject({
        model: "x-ai/grok-4.5",
        provider: "openrouter",
      });
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
