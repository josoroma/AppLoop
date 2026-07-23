import { getHermesConfig, type HermesConfig } from "@/lib/hermes/config";
import { ensureHermesModelRoutesAndDefault } from "@/lib/hermes/gateway-model-sync";
import { getHermesModelOption, resolveHermesModelSelection } from "@/lib/hermes/models";
import { getProjectRepository } from "@/lib/projects/store";

export async function getPreferredHermesConfig(): Promise<HermesConfig> {
  const config = getHermesConfig();
  const preferences = await getProjectRepository().getBuilderPreferences();
  const selection = resolveHermesModelSelection(preferences?.defaultHermesModelId);

  // Keep model_routes present even if the gateway was started with an older
  // config (runAliases). Restart still happens on Settings save.
  try {
    ensureHermesModelRoutesAndDefault(getHermesModelOption(selection.optionId));
  } catch {
    // Config write can fail in read-only test environments; keep request path alive.
  }

  return {
    ...config,
    inferenceModel: selection.model,
    inferenceProvider: selection.provider === "mlx-vlm" ? "custom" : selection.provider,
  };
}

export async function getPreferredHermesModelSelection() {
  const preferences = await getProjectRepository().getBuilderPreferences();
  return resolveHermesModelSelection(preferences?.defaultHermesModelId);
}
