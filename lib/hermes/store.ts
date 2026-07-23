import { HermesClient } from "@/lib/hermes/client";
import { getPreferredHermesConfig } from "@/lib/hermes/preferences";

/**
 * Build a Hermes client using the builder-level preferred model.
 * Create a fresh client per request so preference changes apply immediately
 * without restarting the Next.js process.
 */
export async function getHermesClient() {
  return new HermesClient(await getPreferredHermesConfig());
}
