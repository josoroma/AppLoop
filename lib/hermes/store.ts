import { HermesClient } from "@/lib/hermes/client";
import { getHermesConfig } from "@/lib/hermes/config";

let client: HermesClient | null = null;

export function getHermesClient() {
  if (!client) {
    client = new HermesClient(getHermesConfig());
  }

  return client;
}