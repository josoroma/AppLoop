import { getServerEnv, requireHermesApiKey } from "@/lib/env/server";

export type HermesConfig = {
  baseUrl: string;
  apiKey: string;
  transport: "rest" | "websocket";
  gatewayIntegration?: string;
  inferenceModel?: string;
  inferenceProvider?: string;
};

export function getHermesConfig(): HermesConfig {
  const env = getServerEnv();

  return {
    baseUrl: resolveHermesBaseUrl(env),
    apiKey: requireHermesApiKey(env),
    transport: env.HERMES_TRANSPORT,
    gatewayIntegration: env.HERMES_GATEWAY_INTEGRATION,
    inferenceModel: env.HERMES_INFERENCE_MODEL ?? env.HERMES_MODEL,
    inferenceProvider: env.HERMES_INFERENCE_PROVIDER,
  };
}

function resolveHermesBaseUrl(env: ReturnType<typeof getServerEnv>) {
  if (env.HERMES_BASE_URL !== "http://127.0.0.1:8642") {
    return env.HERMES_BASE_URL;
  }

  if (env.API_SERVER_PORT) {
    return `http://${env.API_SERVER_HOST ?? "127.0.0.1"}:${env.API_SERVER_PORT}`;
  }

  return env.HERMES_BASE_URL;
}