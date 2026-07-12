import type { RuntimeLogEntry } from "@/lib/runtime/logs";

export type PreviewViewportMode = "desktop" | "tablet" | "mobile" | "custom";

export type PreviewViewport = {
  mode: PreviewViewportMode;
  width: number | null;
  height: number | null;
};

export type PreviewBuildState = "idle" | "compiling" | "failed";

export const PREVIEW_IFRAME_SANDBOX = "allow-forms allow-modals allow-popups allow-same-origin allow-scripts";
export const PREVIEW_CSP_STRATEGY = "Preview apps run on a separate origin; production hosting should use wildcard preview domains with no shared builder auth cookies.";

export const PREVIEW_VIEWPORT_PRESETS: Record<Exclude<PreviewViewportMode, "custom">, PreviewViewport> = {
  desktop: { mode: "desktop", width: null, height: null },
  tablet: { mode: "tablet", width: 820, height: 1100 },
  mobile: { mode: "mobile", width: 390, height: 844 },
};

export const DEFAULT_PREVIEW_VIEWPORT: PreviewViewport = PREVIEW_VIEWPORT_PRESETS.desktop;

export function getPreviewOrigin(previewUrl: string): string | null {
  try {
    return new URL(previewUrl).origin;
  } catch {
    return null;
  }
}

export function normalizePreviewRoute(input: string, previewOrigin: string): string | null {
  const value = input.trim();

  if (value.length === 0) {
    return "/";
  }

  try {
    const parsedUrl = new URL(value, previewOrigin);

    if (parsedUrl.origin !== previewOrigin) {
      return null;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return null;
  }
}

export function buildPreviewFrameSrc(previewUrl: string, route: string): string {
  const origin = getPreviewOrigin(previewUrl);

  if (!origin) {
    return previewUrl;
  }

  const normalizedRoute = normalizePreviewRoute(route, origin) ?? "/";

  return new URL(normalizedRoute, origin).toString();
}

export function createPreviewNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export function isTrustedPreviewMessage(input: {
  eventOrigin: string;
  previewOrigin: string;
  projectId: string;
  previewNonce: string;
  data: { projectId?: unknown; previewNonce?: unknown } | null | undefined;
}) {
  return input.eventOrigin === input.previewOrigin && input.data?.projectId === input.projectId && input.data?.previewNonce === input.previewNonce;
}

export function derivePreviewBuildState(runtimeStatus: "stopped" | "starting" | "running" | "failed", logs: RuntimeLogEntry[]): PreviewBuildState {
  if (runtimeStatus === "failed") {
    return "failed";
  }

  const recentCompileLog = [...logs]
    .reverse()
    .find((entry) => /compil|error|failed/i.test(entry.message));

  if (!recentCompileLog) {
    return "idle";
  }

  if (/failed|error/i.test(recentCompileLog.message)) {
    return "failed";
  }

  if (/compiling/i.test(recentCompileLog.message)) {
    return "compiling";
  }

  return "idle";
}

export function serializePreviewViewport(viewport: PreviewViewport): string {
  return JSON.stringify(viewport);
}

export function parsePreviewViewport(value: string | null): PreviewViewport {
  if (!value) {
    return DEFAULT_PREVIEW_VIEWPORT;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PreviewViewport>;

    if (parsed.mode === "desktop" || parsed.mode === "tablet" || parsed.mode === "mobile") {
      return PREVIEW_VIEWPORT_PRESETS[parsed.mode];
    }

    if (parsed.mode === "custom") {
      return {
        mode: "custom",
        width: typeof parsed.width === "number" && parsed.width > 0 ? parsed.width : 1024,
        height: typeof parsed.height === "number" && parsed.height > 0 ? parsed.height : 768,
      };
    }
  } catch {
    return DEFAULT_PREVIEW_VIEWPORT;
  }

  return DEFAULT_PREVIEW_VIEWPORT;
}