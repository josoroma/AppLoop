"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Loader2, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { useBuilderUiStore } from "@/components/builder/use-builder-ui-store";
import { Button } from "@/components/ui/button";
import { getRuntimeStateCopy } from "@/lib/builder/ux";
import type { RuntimeLogEntry } from "@/lib/runtime/logs";
import {
  buildPreviewFrameSrc,
  createPreviewNonce,
  derivePreviewBuildState,
  getPreviewOrigin,
  isTrustedPreviewMessage,
  normalizePreviewRoute,
  PREVIEW_IFRAME_SANDBOX,
  parsePreviewViewport,
  DEFAULT_PREVIEW_VIEWPORT,
  PREVIEW_VIEWPORT_PRESETS,
  serializePreviewViewport,
  type PreviewViewport,
  type PreviewViewportMode,
} from "@/lib/preview/browser";
import { getClassNameLabel, getPreferredSelector, parseVisualSelection, type InspectorParentMessage, type VisualSelection } from "@/lib/visual-selector/types";

type PreviewFrameProps = {
  projectId: string;
  projectName: string;
  previewUrl: string;
  defaultRoute: string;
  runtimeStatus: "stopped" | "starting" | "running" | "failed";
  runtimeLogs: RuntimeLogEntry[];
  runtimeLogsCollapsed: boolean;
  onToggleRuntimeLogs: () => void;
};

type PreviewRouteMessage = {
  type?: string;
  projectId?: unknown;
  previewNonce?: unknown;
  route?: unknown;
  href?: unknown;
  selection?: unknown;
  update?: unknown;
};

function getViewportStorageKey(projectId: string) {
  return `apploop:preview-viewport:${projectId}`;
}

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHydratedClient() {
  return useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
}

function readStoredViewport(projectId: string): PreviewViewport {
  return parsePreviewViewport(window.localStorage.getItem(getViewportStorageKey(projectId)));
}

export function PreviewFrame({ defaultRoute, onToggleRuntimeLogs, previewUrl, projectId, projectName, runtimeLogs, runtimeLogsCollapsed, runtimeStatus }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewportShellRef = useRef<HTMLDivElement>(null);
  const pendingInspectorRouteRef = useRef<string | null>(null);
  const inspectorEnabled = useBuilderUiStore((state) => state.inspectorEnabled);
  const hoveredElement = useBuilderUiStore((state) => state.hoveredElement);
  const selectedElements = useBuilderUiStore((state) => state.selectedElements);
  const setHoveredElement = useBuilderUiStore((state) => state.setHoveredElement);
  const toggleSelectedElement = useBuilderUiStore((state) => state.toggleSelectedElement);
  const updateSelectedElementRect = useBuilderUiStore((state) => state.updateSelectedElementRect);
  const previewOrigin = getPreviewOrigin(previewUrl);
  const initialRoute = normalizePreviewRoute(defaultRoute, previewOrigin ?? "http://127.0.0.1") ?? "/";
  const [route, setRoute] = useState(initialRoute);
  const [routeInput, setRouteInput] = useState(initialRoute);
  const [historyStack, setHistoryStack] = useState([initialRoute]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewNonce, setPreviewNonce] = useState(() => createPreviewNonce());
  const [isLoading, setIsLoading] = useState(runtimeStatus === "running");
  const [frameError, setFrameError] = useState<string | null>(null);
  const hydratedClient = useHydratedClient();
  const [viewportOverride, setViewportOverride] = useState<{ projectId: string; viewport: PreviewViewport } | null>(null);
  const viewport = viewportOverride?.projectId === projectId ? viewportOverride.viewport : hydratedClient ? readStoredViewport(projectId) : DEFAULT_PREVIEW_VIEWPORT;
  const frameSrc = buildPreviewFrameSrc(previewUrl, route);
  const buildState = derivePreviewBuildState(runtimeStatus, runtimeLogs);
  const canLoadPreview = runtimeStatus === "running" && Boolean(previewOrigin);
  const showFailure = runtimeStatus === "failed" || !previewOrigin || buildState === "failed" || Boolean(frameError);
  const runtimeCopy = getRuntimeStateCopy(runtimeStatus, buildState);

  const postInspectorEnabled = useCallback(() => {
    if (!previewOrigin || !iframeRef.current?.contentWindow) {
      return;
    }

    const message: InspectorParentMessage = {
      type: "apploop:inspector:set-enabled",
      enabled: inspectorEnabled,
      projectId,
      previewNonce,
    };

    iframeRef.current.contentWindow.postMessage(message, previewOrigin);
  }, [inspectorEnabled, previewNonce, previewOrigin, projectId]);

  function setViewport(nextViewport: PreviewViewport | ((currentViewport: PreviewViewport) => PreviewViewport)) {
    setViewportOverride({
      projectId,
      viewport: typeof nextViewport === "function" ? nextViewport(viewport) : nextViewport,
    });
  }

  useEffect(() => {
    if (!hydratedClient) {
      return;
    }

    window.localStorage.setItem(getViewportStorageKey(projectId), serializePreviewViewport(viewport));
  }, [hydratedClient, projectId, viewport]);

  useEffect(() => {
    const viewportShell = viewportShellRef.current;

    if (!viewportShell) {
      return;
    }

    viewportShell.style.setProperty("--preview-width", viewport.width ? `${viewport.width}px` : "100%");
    viewportShell.style.setProperty("--preview-height", viewport.height ? `${viewport.height}px` : "100%");
  }, [viewport]);

  useEffect(() => {
    if (!previewOrigin) {
      return;
    }

    const handleMessage = (event: MessageEvent<PreviewRouteMessage>) => {
      if (event.origin === previewOrigin && event.data?.type === "apploop:inspector-ready") {
        postInspectorEnabled();
        return;
      }

      if (!isTrustedPreviewMessage({ eventOrigin: event.origin, previewOrigin, projectId, previewNonce, data: event.data })) {
        return;
      }

      if (event.data?.type === "apploop:inspector-hover") {
        setHoveredElement(parseVisualSelection(event.data.selection));
        return;
      }

      if (event.data?.type === "apploop:inspector-select") {
        const selection = parseVisualSelection(event.data.selection);

        if (selection && selection.projectId === projectId && selection.previewNonce === previewNonce) {
          if (event.data.update === true) {
            updateSelectedElementRect(selection.preferredSelector, selection.boundingRect);
          } else {
            toggleSelectedElement(selection);
            toast.success(`Target toggled: ${getClassNameLabel(selection)}`);
          }
        }

        const nextRouteValue = typeof event.data.route === "string" ? event.data.route : event.data.href;

        if (typeof nextRouteValue === "string") {
          const nextRoute = normalizePreviewRoute(nextRouteValue, previewOrigin);

          if (nextRoute) {
            pendingInspectorRouteRef.current = nextRoute;
            setRoute(nextRoute);
            setRouteInput(nextRoute);
            setIsLoading(runtimeStatus === "running");
            setHistoryStack((entries) => [...entries.slice(0, historyIndex + 1), nextRoute]);
            setHistoryIndex((index) => index + 1);
          }
        }
        return;
      }

      if (event.data?.type !== "apploop:preview-route") {
        return;
      }

      const nextRouteValue = typeof event.data.route === "string" ? event.data.route : event.data.href;

      if (typeof nextRouteValue !== "string") {
        return;
      }

      const nextRoute = normalizePreviewRoute(nextRouteValue, previewOrigin);

      if (!nextRoute) {
        return;
      }

      if (pendingInspectorRouteRef.current && nextRoute !== pendingInspectorRouteRef.current) {
        return;
      }

      if (nextRoute === pendingInspectorRouteRef.current) {
        pendingInspectorRouteRef.current = null;
      }

      setRoute(nextRoute);
      setRouteInput(nextRoute);
      setIsLoading(runtimeStatus === "running");
      setHistoryStack((entries) => [...entries.slice(0, historyIndex + 1), nextRoute]);
      setHistoryIndex((index) => index + 1);
    };

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [historyIndex, postInspectorEnabled, previewNonce, previewOrigin, projectId, runtimeStatus, setHoveredElement, toggleSelectedElement, updateSelectedElementRect]);

  useEffect(() => {
    postInspectorEnabled();
  }, [frameSrc, postInspectorEnabled]);

  useEffect(() => {
    if (!isLoading || !canLoadPreview) {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsLoading(false), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [canLoadPreview, frameSrc, isLoading]);

  const overlaySelections = selectedElements.length > 0 ? selectedElements : (inspectorEnabled && hoveredElement ? [hoveredElement] : []);

  function pushRoute(nextRoute: string) {
    setRoute(nextRoute);
    setRouteInput(nextRoute);
    setIsLoading(runtimeStatus === "running");
    setHistoryStack((entries) => [...entries.slice(0, historyIndex + 1), nextRoute]);
    setHistoryIndex((index) => index + 1);
  }

  function navigateByIndex(nextIndex: number) {
    const nextRoute = historyStack[nextIndex];

    if (!nextRoute) {
      return;
    }

    setRoute(nextRoute);
    setRouteInput(nextRoute);
    setHistoryIndex(nextIndex);
    setIsLoading(runtimeStatus === "running");
  }

  function submitRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!previewOrigin) {
      return;
    }

    const nextRoute = normalizePreviewRoute(routeInput, previewOrigin);

    if (!nextRoute) {
      setRouteInput(route);
      return;
    }

    pushRoute(nextRoute);
  }

  function setPreset(mode: PreviewViewportMode) {
    if (mode === "custom") {
      setViewport((currentViewport) => ({
        mode: "custom",
        width: currentViewport.width ?? 1024,
        height: currentViewport.height ?? 768,
      }));
      return;
    }

    setViewport(PREVIEW_VIEWPORT_PRESETS[mode]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b bg-card px-3 py-2 text-sm">
        <div className="flex items-center gap-1">
          <Button
            disabled={historyIndex === 0}
            onClick={() => navigateByIndex(historyIndex - 1)}
            size="icon"
            title="Back"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Button>
          <Button
            disabled={historyIndex >= historyStack.length - 1}
            onClick={() => navigateByIndex(historyIndex + 1)}
            size="icon"
            title="Forward"
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Forward</span>
          </Button>
          <Button
            disabled={!canLoadPreview}
            onClick={() => {
              setPreviewNonce(createPreviewNonce());
              setReloadKey((key) => key + 1);
              setFrameError(null);
              setIsLoading(runtimeStatus === "running");
            }}
            size="icon"
            title="Reload preview"
            type="button"
            variant="outline"
          >
            <RefreshCw className="size-4" />
            <span className="sr-only">Reload preview</span>
          </Button>
        </div>
        <form className="min-w-48 flex-1" onSubmit={submitRoute}>
          <label className="sr-only" htmlFor="preview-route">
            Preview route
          </label>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            id="preview-route"
            onChange={(event) => setRouteInput(event.target.value)}
            value={routeInput}
          />
        </form>
        <select
          aria-label="Preview viewport size"
          className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setPreset(event.target.value as PreviewViewportMode)}
          value={viewport.mode}
        >
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
          <option value="mobile">Mobile</option>
          <option value="custom">Custom</option>
        </select>
        {viewport.mode === "custom" ? (
          <div className="flex items-center gap-1">
            <input
              aria-label="Custom preview width"
              className="h-9 w-20 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              min={240}
              onChange={(event) => setViewport((current) => ({ ...current, width: Number(event.target.value) || current.width }))}
              type="number"
              value={viewport.width ?? 1024}
            />
            <input
              aria-label="Custom preview height"
              className="h-9 w-20 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              min={320}
              onChange={(event) => setViewport((current) => ({ ...current, height: Number(event.target.value) || current.height }))}
              type="number"
              value={viewport.height ?? 768}
            />
          </div>
        ) : null}
        <Button asChild disabled={!canLoadPreview} size="icon" title="Open preview in new tab" variant="outline">
          <a href={canLoadPreview ? frameSrc : "#"} rel="noreferrer" target="_blank">
            <ExternalLink className="size-4" />
            <span className="sr-only">Open preview in new tab</span>
          </a>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black pt-14 pr-4 pb-4 pl-4">
        <div
          className="preview-viewport-frame relative rounded-md border bg-black shadow-sm"
          ref={viewportShellRef}
        >
          {canLoadPreview ? (
            <iframe
              className="h-full w-full bg-black"
              key={`${frameSrc}-${reloadKey}`}
              onLoad={() => {
                if (pendingInspectorRouteRef.current === route) {
                  pendingInspectorRouteRef.current = null;
                }
                setIsLoading(false);
                window.setTimeout(postInspectorEnabled, 100);
              }}
              onError={() => setFrameError("The preview iframe failed to load.")}
              ref={iframeRef}
              sandbox={PREVIEW_IFRAME_SANDBOX}
              src={frameSrc}
              title={`${projectName} preview`}
            />
          ) : null}
          <div className="sr-only" aria-live="polite">
            {selectedElements.length > 0 ? `Selected ${selectedElements.length} target${selectedElements.length > 1 ? "s" : ""}` : overlaySelections.length > 0 ? `Inspecting ${getClassNameLabel(overlaySelections[0])}` : runtimeCopy.title}
          </div>
          {isLoading && canLoadPreview ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading preview
            </div>
          ) : null}
          {buildState === "compiling" ? (
            <div className="absolute right-3 top-3 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-sm">
              Compiling
            </div>
          ) : null}
          {showFailure ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-6 text-center text-sm">
              <p className="font-medium text-foreground">{frameError ? "Iframe load failed" : runtimeCopy.title}</p>
              <p className="mt-2 max-w-sm text-muted-foreground">
                {frameError ?? runtimeCopy.detail}
              </p>
            </div>
          ) : null}
          {!showFailure && !canLoadPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-6 text-center text-sm">
              <p className="font-medium text-foreground">{runtimeCopy.title}</p>
              <p className="mt-2 max-w-sm text-muted-foreground">{runtimeCopy.detail}</p>
            </div>
          ) : null}
          {overlaySelections.map((selection) => (
            <SelectionOverlay key={selection.preferredSelector} locked={selectedElements.some((el) => el.preferredSelector === selection.preferredSelector)} selection={selection} />
          ))}
        </div>
      </div>
      <button
        aria-controls="raw-runtime-logs"
        aria-expanded={!runtimeLogsCollapsed}
        className="flex min-h-9 w-full items-center justify-between gap-3 border-t bg-card px-3 text-left text-xs text-muted-foreground transition hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={onToggleRuntimeLogs}
        title={runtimeLogsCollapsed ? "Show runtime logs" : "Hide runtime logs"}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1">
          {viewport.mode === "mobile" ? <Smartphone className="size-3 shrink-0" /> : viewport.mode === "tablet" ? <Tablet className="size-3 shrink-0" /> : <Monitor className="size-3 shrink-0" />}
          <span className="truncate">{viewport.mode === "desktop" ? "Fluid desktop" : `${viewport.width} x ${viewport.height}`}</span>
        </span>
        <span className="min-w-0 truncate">{frameSrc}</span>
        <span className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate">Inspect shortcuts: Option+] next, Option+[ previous</span>
          {runtimeLogsCollapsed ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
        </span>
      </button>
    </div>
  );
}

function SelectionOverlay({ locked, selection }: { locked: boolean; selection: VisualSelection }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const selector = getPreferredSelector(selection);
  const classNameLabel = getClassNameLabel(selection);

  useEffect(() => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return;
    }

    overlay.style.setProperty("--selection-x", `${selection.boundingRect.x}px`);
    overlay.style.setProperty("--selection-y", `${selection.boundingRect.y}px`);
    overlay.style.setProperty("--selection-width", `${selection.boundingRect.width}px`);
    overlay.style.setProperty("--selection-height", `${selection.boundingRect.height}px`);
  }, [selection]);

  async function copySelector() {
    await navigator.clipboard?.writeText(selector);
    toast.success(`Copied ${selector}`);
  }

  return (
    <div aria-hidden="true" className={locked ? "preview-selection-overlay is-locked" : "preview-selection-overlay"} ref={overlayRef}>
      <button className="preview-selection-label" onClick={copySelector} tabIndex={-1} type="button">
        <span className="preview-selection-label-class">{classNameLabel}</span>
        <span className="preview-selection-label-selector">
          {selector}
          {locked ? " locked" : ""}
        </span>
      </button>
    </div>
  );
}