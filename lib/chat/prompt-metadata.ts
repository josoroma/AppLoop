const TARGET_SELECTIONS_MARKER = "Target selections JSON:";

export type PromptMetadata = {
  rawUserPrompt: string;
  composedPrompt: string;
  visualSelectionJson: string | null;
  screenshotIdsJson: string | null;
};

export function extractPromptMetadata(composedPrompt: string, screenshotIds: string[] = []): PromptMetadata {
  const markerIndex = composedPrompt.indexOf(TARGET_SELECTIONS_MARKER);
  const rawUserPrompt = markerIndex === -1 ? composedPrompt.trim() : composedPrompt.slice(0, markerIndex).split("\n\nModify only elements")[0]?.trim() ?? composedPrompt.trim();
  const visualSelectionJson = markerIndex === -1 ? null : composedPrompt.slice(markerIndex + TARGET_SELECTIONS_MARKER.length).trim() || null;

  return {
    rawUserPrompt,
    composedPrompt,
    visualSelectionJson,
    screenshotIdsJson: screenshotIds.length > 0 ? JSON.stringify(screenshotIds) : null,
  };
}
