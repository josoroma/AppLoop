import { z } from "zod";

export const BUILDER_PORT = 3001;
export const DEFAULT_HERMES_MODEL = "deepseek/deepseek-v4-pro";
export const DEFAULT_HERMES_PROVIDER = "openrouter";

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HERMES_BASE_URL: z.string().url().default("http://127.0.0.1:8642"),
    HERMES_API_KEY: z.string().min(1).optional(),
    HERMES_TRANSPORT: z.enum(["rest", "websocket"]).default("rest"),
    HERMES_GATEWAY_INTEGRATION: z.string().min(1).optional(),
    HERMES_MODEL: z.string().min(1).default(DEFAULT_HERMES_MODEL),
    HERMES_INFERENCE_MODEL: z.string().min(1).default(DEFAULT_HERMES_MODEL),
    HERMES_INFERENCE_PROVIDER: z.string().min(1).default(DEFAULT_HERMES_PROVIDER),
    API_SERVER_KEY: z.string().min(1).optional(),
    API_SERVER_HOST: z.string().min(1).optional(),
    API_SERVER_PORT: z.coerce.number().int().min(1024).max(65535).optional(),
    PROJECTS_ROOT: z.string().min(1).default(".apploop/projects"),
    PREVIEW_PORT_START: z.coerce.number().int().min(1024).max(65535).default(3100),
    PREVIEW_PORT_END: z.coerce.number().int().min(1024).max(65535).default(3199),
    DATABASE_URL: z.string().min(1).default("file:.apploop/builder.sqlite"),
    RUNTIME_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  })
  .superRefine((env, context) => {
    if (env.PREVIEW_PORT_START > env.PREVIEW_PORT_END) {
      context.addIssue({
        code: "custom",
        path: ["PREVIEW_PORT_START"],
        message: "PREVIEW_PORT_START must be less than or equal to PREVIEW_PORT_END.",
      });
    }

    if (env.PREVIEW_PORT_START <= BUILDER_PORT && BUILDER_PORT <= env.PREVIEW_PORT_END) {
      context.addIssue({
        code: "custom",
        path: ["PREVIEW_PORT_START"],
        message: "Generated project preview ports must not include the builder port 3001.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function requireHermesApiKey(env: ServerEnv) {
  const apiKey = env.HERMES_API_KEY ?? env.API_SERVER_KEY;

  if (!apiKey) {
    throw new Error("HERMES_API_KEY or API_SERVER_KEY is not configured for server-side Hermes access.");
  }

  return apiKey;
}

export function formatEnvError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}