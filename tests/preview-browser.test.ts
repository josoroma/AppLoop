import { describe, expect, it } from "vitest";
import {
  buildPreviewFrameSrc,
  isTrustedPreviewMessage,
  derivePreviewBuildState,
  normalizePreviewRoute,
  parsePreviewViewport,
  serializePreviewViewport,
} from "@/lib/preview/browser";

describe("E8 live preview browser", () => {
  it("normalizes preview routes to the preview origin", () => {
    expect(normalizePreviewRoute("dashboard/settings?tab=team#roles", "http://127.0.0.1:3100")).toBe(
      "/dashboard/settings?tab=team#roles",
    );
    expect(normalizePreviewRoute("http://127.0.0.1:3100/dashboard", "http://127.0.0.1:3100")).toBe("/dashboard");
    expect(normalizePreviewRoute("http://evil.test/dashboard", "http://127.0.0.1:3100")).toBeNull();
  });

  it("requires preview postMessage origin, project, and nonce", () => {
    expect(
      isTrustedPreviewMessage({
        eventOrigin: "http://127.0.0.1:3100",
        previewOrigin: "http://127.0.0.1:3100",
        projectId: "project-1",
        previewNonce: "nonce-123456",
        data: { projectId: "project-1", previewNonce: "nonce-123456" },
      }),
    ).toBe(true);
    expect(
      isTrustedPreviewMessage({
        eventOrigin: "http://evil.test",
        previewOrigin: "http://127.0.0.1:3100",
        projectId: "project-1",
        previewNonce: "nonce-123456",
        data: { projectId: "project-1", previewNonce: "nonce-123456" },
      }),
    ).toBe(false);
  });

  it("preserves the current route across preview base URL changes", () => {
    expect(buildPreviewFrameSrc("http://127.0.0.1:3100", "/dashboard/settings?tab=team")).toBe(
      "http://127.0.0.1:3100/dashboard/settings?tab=team",
    );
    expect(buildPreviewFrameSrc("http://127.0.0.1:3111", "/dashboard/settings?tab=team")).toBe(
      "http://127.0.0.1:3111/dashboard/settings?tab=team",
    );
  });

  it("parses persisted viewport sizes per project", () => {
    const storedViewport = serializePreviewViewport({ mode: "custom", width: 960, height: 720 });

    expect(parsePreviewViewport(storedViewport)).toEqual({ mode: "custom", width: 960, height: 720 });
    expect(parsePreviewViewport('{"mode":"mobile"}')).toEqual({ mode: "mobile", width: 390, height: 844 });
    expect(parsePreviewViewport("bad json")).toEqual({ mode: "desktop", width: null, height: null });
  });

  it("detects compiling and compilation failure states from runtime logs", () => {
    expect(
      derivePreviewBuildState("running", [{ projectId: "project-1", timestamp: "1", stream: "stdout", message: "Compiling /dashboard ..." }]),
    ).toBe("compiling");
    expect(
      derivePreviewBuildState("running", [{ projectId: "project-1", timestamp: "2", stream: "stderr", message: "Failed to compile." }]),
    ).toBe("failed");
    expect(derivePreviewBuildState("failed", [])).toBe("failed");
  });
});