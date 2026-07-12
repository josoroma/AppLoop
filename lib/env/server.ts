import { formatEnvError, requireHermesApiKey, serverEnvSchema } from "@/lib/env/schema";
import { assertNoPublicHermesEnvironment } from "@/lib/security/secrets";

export function getServerEnv(source: NodeJS.ProcessEnv = process.env) {
  assertNoPublicHermesEnvironment(source);

  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid AppLoop environment:\n${formatEnvError(result.error)}`);
  }

  return result.data;
}

export { requireHermesApiKey };