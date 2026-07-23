import { z } from "zod";
import { DEFAULT_HERMES_MODEL, DEFAULT_HERMES_PROVIDER } from "@/lib/env/schema";

export const HERMES_MODEL_OPTIONS = [
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "Default OpenRouter model for AppLoop builder edits and template authoring.",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-pro",
    kind: "openrouter",
    badge: "OpenRouter",
  },
  {
    id: "grok-4-5",
    label: "Grok 4.5",
    description: "xAI Grok 4.5 via OpenRouter for general coding and product edits.",
    provider: "openrouter",
    model: "x-ai/grok-4.5",
    kind: "openrouter",
    badge: "OpenRouter",
  },
  {
    id: "nemotron-3-ultra-free",
    label: "Nemotron 3 Ultra (free)",
    description: "NVIDIA Nemotron 3 Ultra free route on OpenRouter (rate-limited).",
    provider: "openrouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    kind: "openrouter",
    badge: "Free",
  },
  {
    id: "local-mlx-vlm",
    label: "Local MLX VLM",
    description: "Local Qwen via `make mlx-vlm-server` (http://127.0.0.1:8080/v1).",
    provider: "mlx-vlm",
    model: "local-qwen3.6-27b-optiq-4bit",
    kind: "local",
    badge: "Local",
  },
] as const;

export type HermesModelOption = (typeof HERMES_MODEL_OPTIONS)[number];
export type HermesModelOptionId = HermesModelOption["id"];

export const hermesModelOptionIdSchema = z.enum(
  HERMES_MODEL_OPTIONS.map((option) => option.id) as [HermesModelOptionId, ...HermesModelOptionId[]],
);

export const DEFAULT_HERMES_MODEL_OPTION_ID: HermesModelOptionId =
  HERMES_MODEL_OPTIONS.find((option) => option.model === DEFAULT_HERMES_MODEL)?.id ?? HERMES_MODEL_OPTIONS[0].id;

export function listHermesModelOptions() {
  return HERMES_MODEL_OPTIONS.map((option) => ({ ...option }));
}

export function getHermesModelOption(id: string | null | undefined): HermesModelOption {
  return HERMES_MODEL_OPTIONS.find((option) => option.id === id) ?? getDefaultHermesModelOption();
}

export function getDefaultHermesModelOption(): HermesModelOption {
  return (
    HERMES_MODEL_OPTIONS.find((option) => option.id === DEFAULT_HERMES_MODEL_OPTION_ID) ?? HERMES_MODEL_OPTIONS[0]
  );
}

export function resolveHermesModelSelection(id: string | null | undefined) {
  const option = getHermesModelOption(id);

  return {
    optionId: option.id,
    model: option.model,
    provider: option.provider,
    label: option.label,
    kind: option.kind,
  };
}

export function hermesModelOptionFromEnv(env: {
  inferenceModel?: string | null;
  inferenceProvider?: string | null;
}): HermesModelOption {
  const model = env.inferenceModel?.trim() || DEFAULT_HERMES_MODEL;
  const provider = env.inferenceProvider?.trim() || DEFAULT_HERMES_PROVIDER;

  return (
    HERMES_MODEL_OPTIONS.find((option) => option.model === model && option.provider === provider) ??
    HERMES_MODEL_OPTIONS.find((option) => option.model === model) ??
    getDefaultHermesModelOption()
  );
}
