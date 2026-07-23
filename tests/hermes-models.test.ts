import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERMES_MODEL_OPTION_ID,
  getHermesModelOption,
  hermesModelOptionIdSchema,
  listHermesModelOptions,
  resolveHermesModelSelection,
} from "@/lib/hermes/models";

describe("Hermes model preferences", () => {
  it("exposes the curated builder gateway options", () => {
    const ids = listHermesModelOptions().map((option) => option.id);

    expect(ids).toEqual([
      "deepseek-v4-pro",
      "grok-4-5",
      "nemotron-3-ultra-free",
      "local-mlx-vlm",
    ]);
    expect(DEFAULT_HERMES_MODEL_OPTION_ID).toBe("deepseek-v4-pro");
  });

  it("resolves openrouter and local model routes", () => {
    expect(resolveHermesModelSelection("grok-4-5")).toMatchObject({
      model: "x-ai/grok-4.5",
      provider: "openrouter",
    });
    expect(resolveHermesModelSelection("nemotron-3-ultra-free")).toMatchObject({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      provider: "openrouter",
    });
    expect(resolveHermesModelSelection("local-mlx-vlm")).toMatchObject({
      model: "local-qwen3.6-27b-optiq-4bit",
      provider: "mlx-vlm",
      kind: "local",
    });
  });

  it("falls back to the default option for unknown ids", () => {
    expect(getHermesModelOption("not-a-real-model").id).toBe(DEFAULT_HERMES_MODEL_OPTION_ID);
    expect(hermesModelOptionIdSchema.safeParse("grok-4-5").success).toBe(true);
    expect(hermesModelOptionIdSchema.safeParse("nope").success).toBe(false);
  });
});
