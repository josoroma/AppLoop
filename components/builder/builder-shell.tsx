"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { AlertTriangle, Bot, ChevronLeft, ChevronRight, FolderGit2, House, LoaderCircle, MousePointerClick, Play, RotateCcw, SendHorizontal, Settings2, Square, X } from "lucide-react";
import { Group, Panel, Separator, usePanelRef, type Layout } from "react-resizable-panels";
import { BuilderThemeSelect } from "@/components/builder/builder-theme-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBuilderUiStore, type ChatCheckpoint } from "@/components/builder/use-builder-ui-store";
import { JsonHighlight } from "@/components/builder/json-highlight";
import { PreviewFrame } from "@/components/builder/preview-frame";
import { ChatCheckpoints } from "@/components/builder/chat-checkpoints";
import { HermesContextUsage } from "@/components/builder/hermes-context-usage";
import { createFileSnapshot, revertToFileSnapshot } from "@/lib/chat/file-snapshot";
import { listChatCheckpoints, saveChatCheckpoint, deleteChatCheckpoint } from "@/lib/chat/checkpoint-actions";
import { getBuilderLayoutStorageKey, groupHermesActivities, parseBuilderSplitLayout, serializeBuilderSplitLayout } from "@/lib/builder/ux";
import type { BuilderChatMessage } from "@/lib/chat/messages";
import { getMessageText } from "@/lib/chat/messages";
import { openProjectAction, updateProjectSettingsAction } from "@/lib/projects/actions";
import { restartRuntimeAction, startRuntimeAction, stopRuntimeAction, stopRuntimeAndReturnHomeAction } from "@/lib/runtime/actions";
import type { RuntimeLogEntry } from "@/lib/runtime/logs";
import { createVisualSelectionPrompt, getClassNameLabel, getClassNameSelector, getPreferredSelector, type ScreenshotAttachment } from "@/lib/visual-selector/types";

const chatTransport = new DefaultChatTransport<BuilderChatMessage>({ api: "/api/chat" });
const DEFAULT_BUILDER_LAYOUT = { chat: 38, preview: 62 };
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHydratedClient() {
  return useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
}

function readStoredBuilderLayout(projectId: string) {
  if (typeof window === "undefined") {
    return DEFAULT_BUILDER_LAYOUT;
  }

  return parseBuilderSplitLayout(window.localStorage.getItem(getBuilderLayoutStorageKey(projectId)));
}

type BuilderShellProps = {
  projectId: string;
  projectName: string;
  previewUrl: string;
  activeProjects: Array<{
    id: string;
    name: string;
  }>;
  initialMessages: BuilderChatMessage[];
  packageInstallPolicy: "auto" | "ask" | "never";
  validationDepth: "quick" | "standard" | "deep";
  autoStartPreview: boolean;
  defaultRoute: string;
  selectedThemeId: string;
  themeOptions: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  runtimeStatus: "stopped" | "starting" | "running" | "failed";
  runtimePid: number | null;
  runtimeExitCode: number | null;
  runtimeExitSignal: string | null;
  runtimeLogs: RuntimeLogEntry[];
};

export function BuilderShell({
  activeProjects,
  autoStartPreview,
  defaultRoute,
  initialMessages,
  packageInstallPolicy,
  previewUrl,
  projectId,
  projectName,
  runtimeExitCode,
  runtimeExitSignal,
  runtimeLogs,
  runtimePid,
  runtimeStatus,
  selectedThemeId,
  themeOptions,
  validationDepth,
}: BuilderShellProps) {
  const chat = useChat<BuilderChatMessage>({ id: projectId, messages: initialMessages, transport: chatTransport });
  const chatPanelRef = usePanelRef();
  const previewPanelRef = usePanelRef();
  const hydratedClient = useHydratedClient();
  const initialLayout = hydratedClient ? readStoredBuilderLayout(projectId) : DEFAULT_BUILDER_LAYOUT;
  const [liveRuntimeLogs, setLiveRuntimeLogs] = useState(runtimeLogs);
  const [runtimeLogsCollapsed, setRuntimeLogsCollapsed] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<ScreenshotAttachment | null>(null);
  const displayedRuntimeLogs = liveRuntimeLogs.length === 0 ? runtimeLogs : liveRuntimeLogs;
  const inspectorEnabled = useBuilderUiStore((state) => state.inspectorEnabled);
  const selectedElements = useBuilderUiStore((state) => state.selectedElements);
  const settingsOpen = useBuilderUiStore((state) => state.settingsOpen);
  const attachedScreenshots = useBuilderUiStore((state) => state.attachedScreenshots);
  const clearSelectedElements = useBuilderUiStore((state) => state.clearSelectedElements);
  const removeSelectedElement = useBuilderUiStore((state) => state.removeSelectedElement);
  const toggleInspector = useBuilderUiStore((state) => state.toggleInspector);
  const setSettingsOpen = useBuilderUiStore((state) => state.setSettingsOpen);
  const attachClipboardImage = useBuilderUiStore((state) => state.attachClipboardImage);
  const removeScreenshot = useBuilderUiStore((state) => state.removeScreenshot);
  const clearScreenshots = useBuilderUiStore((state) => state.clearScreenshots);
  const saveCheckpoint = useBuilderUiStore((state) => state.saveCheckpoint);
  const loadCheckpoint = useBuilderUiStore((state) => state.loadCheckpoint);
  const checkpoints = useBuilderUiStore((state) => state.checkpoints);
  const setCheckpoints = useBuilderUiStore((state) => state.setCheckpoints);
  const chatBusy = chat.status === "submitted" || chat.status === "streaming";
  const hasInitialSessionRef = useRef(false);
  const checkpointsLoadedRef = useRef(false);

  const handleClipboardPasteStable = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();

          const file = item.getAsFile();

          if (!file) {
            continue;
          }

          try {
            // Read as data URL for immediate thumbnail display
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();

              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });

            // Attach immediately so user sees it right away
            const tempId = `clipboard-${Date.now()}`;

            attachClipboardImage({
              id: tempId,
              dataUrl,
              serverPath: dataUrl,
              source: "clipboard",
              filename: file.name || undefined,
            });

            // Then try uploading in the background for persistence
            try {
              const formData = new FormData();

              formData.append("file", file, file.name || "clipboard.png");
              formData.append("source", "clipboard");

              const uploadResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/screenshots`, {
                method: "POST",
                body: formData,
              });

              if (uploadResponse.ok) {
                const { screenshotId, url } = (await uploadResponse.json()) as { screenshotId: string; url: string };

                // Replace temp with server-backed attachment
                removeScreenshot(tempId);
                attachClipboardImage({
                  id: screenshotId,
                  dataUrl,
                  serverPath: url,
                  source: "clipboard",
                  filename: file.name || undefined,
                });
              }
            } catch {
              // Keep the local attachment; upload is optional
            }
          } catch {
            // Silently skip on error
          }

          break; // Process first image only per paste
        }
      }
    },
    [attachClipboardImage, projectId, removeScreenshot],
  );

  function persistPanelLayout(layout: Layout) {
    const chatSize = layout.chat;
    const previewSize = layout.preview;

    if (typeof window !== "undefined" && typeof chatSize === "number" && typeof previewSize === "number") {
      window.localStorage.setItem(getBuilderLayoutStorageKey(projectId), serializeBuilderSplitLayout({ chat: chatSize, preview: previewSize }));
    }
  }

  useEffect(() => {
    void (async () => {
      const rows = await listChatCheckpoints(projectId);

      setCheckpoints(
        rows.map((row) => {
          const data = JSON.parse(row.dataJson) as ChatCheckpoint;

          return { ...data, id: row.id, name: row.name, isSessionBoundary: row.isSessionBoundary, createdAt: Number(row.createdAt) };
        }),
      );
    checkpointsLoadedRef.current = true;
    })();
  }, [projectId, setCheckpoints]);

  useEffect(() => {
    if (!checkpointsLoadedRef.current) return;

    for (const cp of checkpoints) {
      void saveChatCheckpoint(cp.id, projectId, cp.name, cp.isSessionBoundary, JSON.stringify(cp));
    }
  }, [checkpoints, projectId]);

  useEffect(() => {
    window.localStorage.setItem("apploop:last-opened-project", projectId);
    clearSelectedElements();
  }, [clearSelectedElements, projectId]);

  useEffect(() => {
    if (runtimeStatus === "stopped") {
      clearSelectedElements();
    }
  }, [runtimeStatus, clearSelectedElements]);

  useEffect(() => {
    const formData = new FormData();

    formData.append("projectId", projectId);
    void startRuntimeAction(formData);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart runtime after Hermes completes a response to pick up CSS/JS changes
  const prevStatusRef = useRef(chat.status);

  useEffect(() => {
    if (chat.status === "ready" && prevStatusRef.current === "streaming") {
      const formData = new FormData();

      formData.append("projectId", projectId);
      void restartRuntimeAction(formData);
    }

    prevStatusRef.current = chat.status;
  }, [chat.status, projectId]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/projects/${projectId}/runtime/logs`);

    eventSource.onmessage = (event) => {
      const entry = JSON.parse(event.data) as RuntimeLogEntry;
      setLiveRuntimeLogs((entries) => [...entries.slice(-199), entry]);
    };

    return () => eventSource.close();
  }, [projectId]);

  return (
    <main className="flex min-h-screen flex-col p-4">
      <header className="flex min-h-14 items-center justify-between rounded-lg border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FolderGit2 className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Active project
            </p>
            <h1 className="text-base font-semibold">{projectName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form action={stopRuntimeAndReturnHomeAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <Button size="icon" title="Stop preview and return home" type="submit" variant="outline">
              <House className="size-4" />
              <span className="sr-only">Stop preview and return home</span>
            </Button>
          </form>
          <BuilderThemeSelect />
          <form action={openProjectAction} className="hidden items-center gap-2 sm:flex">
            <select
              aria-label="Open project"
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              defaultValue={projectId}
              name="projectId"
            >
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Open
            </Button>
          </form>
          <form action={startRuntimeAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <Button disabled={runtimeStatus === "running" || runtimeStatus === "starting"} size="icon" title="Start preview" type="submit">
              <Play className="size-4" />
              <span className="sr-only">Start preview</span>
            </Button>
          </form>
          <Button aria-pressed={inspectorEnabled} size="icon" title="Inspect elements" variant={inspectorEnabled ? "default" : "secondary"} onClick={toggleInspector}>
            <MousePointerClick className="size-4" />
            <span className="sr-only">Inspect elements</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            <span className="sr-only">Project settings</span>
          </Button>
        </div>
      </header>

      <Group
        key={`${projectId}:${hydratedClient ? "stored" : "default"}`}
        className="mt-4 flex-1 overflow-hidden rounded-lg border bg-card shadow-sm"
        defaultLayout={{ chat: initialLayout.chat, preview: initialLayout.preview }}
        id={`builder-layout-${projectId}`}
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) {
            persistPanelLayout(layout);
          }
        }}
        orientation="horizontal"
        resizeTargetMinimumSize={{ coarse: 36, fine: 20 }}
      >
        <Panel className="relative" collapsedSize={0} collapsible defaultSize={initialLayout.chat} id="chat" minSize={24} panelRef={chatPanelRef}>
          <section className="absolute inset-0 grid grid-rows-[auto_1fr_auto] border-r bg-secondary/35">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Hermes chat
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">Build with context</h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={() => previewPanelRef.current?.collapse()} size="icon" type="button" variant="outline">
                    <ChevronRight className="size-4" />
                    <span className="sr-only">Collapse preview panel</span>
                  </Button>
                  <Button onClick={() => previewPanelRef.current?.expand()} size="icon" type="button" variant="outline">
                    <ChevronLeft className="size-4" />
                    <span className="sr-only">Expand preview panel</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="border-b px-4 py-2">
              <ChatCheckpoints
                onNewSession={async () => {
                  const currentMessages = chat.messages
                    .filter((m) => m.role === "user" || m.role === "assistant");
                  const messageIds = currentMessages.map((m) => m.id);
                  const messageSnapshots = currentMessages.map((m) => ({
                    id: m.id,
                    role: m.role as "user" | "assistant",
                    content: getMessageText(m),
                  }));
                  const hash = await createFileSnapshot(projectId);
                  const sessionNum = checkpoints.filter((cp) => cp.isSessionBoundary).length + 1;

                  saveCheckpoint(`Session ${sessionNum}`, messageIds, hash, true, messageSnapshots);
                  useBuilderUiStore.getState().checkpoints.forEach((cp) => !cp.isSessionBoundary && useBuilderUiStore.getState().removeCheckpoint(cp.id));
                  chat.setMessages([]);
                  clearSelectedElements();
                  clearScreenshots();
                  hasInitialSessionRef.current = false;
                }}
                onRestoreCheckpoint={(cp) => {
                  // Save current session before switching
                  const sessions = checkpoints.filter((c) => c.isSessionBoundary);
                  const currentSession = sessions[sessions.length - 1];

                  if (currentSession && currentSession.id !== cp.id) {
                    const currentMsgs = chat.messages
                      .filter((m) => m.role === "user" || m.role === "assistant")
                      .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: getMessageText(m) }));

                    useBuilderUiStore.getState().updateCheckpointMessages(currentSession.id, currentMsgs);
                  }

                  chat.setMessages(
                    cp.messages.map((m) => ({
                      id: m.id,
                      role: m.role,
                      parts: [{ type: "text" as const, text: m.content }],
                    } as BuilderChatMessage)),
                  );

                  loadCheckpoint(cp.id);
                }}
                projectId={projectId}
              />
            </div>
            {chat.messages.length > 0 && (
              <div className="border-b px-4 py-2">
                <HermesContextUsage
                  messageCount={chat.messages.filter((m) => m.role === "user" || m.role === "assistant").length}
                />
              </div>
            )}
            <div className="space-y-3 overflow-x-hidden overflow-y-auto p-4" role="log">
              {chat.messages.length === 0 ? (
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Hermes is ready for this project.</p>
                  <p className="mt-2">Describe a change, or inspect an element in the preview and ask for a targeted edit.</p>
                </div>
              ) : (
                chat.messages.map((message) => (
                  <article key={message.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <Bot className="size-4 text-primary" />
                      {message.role === "user" ? "You" : "Hermes"}
                      {message.role === "user" && (
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              const cpIndex = checkpoints.findIndex((cp) => cp.messageIds.includes(message.id));
                              const cp = cpIndex !== -1 ? checkpoints[cpIndex] : null;

                              if (cp) {
                                if (cp.commitHash) {
                                  await revertToFileSnapshot(projectId, cp.commitHash);
                                }

                                const idSet = new Set(cp.messageIds);

                                chat.setMessages(chat.messages.filter((m) => idSet.has(m.id)));
                                loadCheckpoint(cp.id);
                              } else {
                                const idx = chat.messages.indexOf(message);
                                const truncated = chat.messages.slice(0, idx);

                                chat.setMessages(truncated);
                              }
                            }}
                            title="Restore project state to before this prompt"
                            type="button"
                          >
                            Restore
                          </button>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              const cpIndex = checkpoints.findIndex((cp) => cp.messageIds.includes(message.id));
                              const cp = cpIndex !== -1 ? checkpoints[cpIndex] : null;

                              if (cp) {
                                if (cp.commitHash) {
                                  await revertToFileSnapshot(projectId, cp.commitHash);
                                }

                                const idSet = new Set(cp.messageIds);

                                chat.setMessages(chat.messages.filter((m) => idSet.has(m.id)));
                                loadCheckpoint(cp.id);

                                const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]');
                                const promptText = getMessageText(message).split("Target classnames")[0]?.trim() ?? "";

                                if (textarea) {
                                  textarea.value = promptText;
                                  textarea.focus();
                                }
                              } else {
                                const idx = chat.messages.indexOf(message);
                                const truncated = chat.messages.slice(0, idx);

                                chat.setMessages(truncated);

                                const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]');
                                const promptText = getMessageText(message).split("Target classnames")[0]?.trim() ?? "";

                                if (textarea) {
                                  textarea.value = promptText;
                                  textarea.focus();
                                }
                              }
                            }}
                            title="Restore to before this prompt and edit"
                            type="button"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    {(() => {
                        const text = getMessageText(message);
                        const jsonMarker = "Target selections JSON:";
                        const jsonIndex = text.indexOf(jsonMarker);

                        if (message.role === "user" && jsonIndex !== -1) {
                          const before = text.slice(0, jsonIndex);
                          const jsonContent = text.slice(jsonIndex + jsonMarker.length);

                          return (
                            <>
                              <p className="whitespace-pre-wrap text-muted-foreground">{before}</p>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                                  {jsonMarker}
                                </summary>
                                <div className="mt-2 max-h-64 overflow-auto">
                                  <JsonHighlight json={jsonContent} />
                                </div>
                              </details>
                            </>
                          );
                        }

                        return (
                          <p className="whitespace-pre-wrap text-muted-foreground">{text}</p>
                        );
                      })()}
                    <HermesActivityCards message={message} />
                  </article>
                ))
              )}
            </div>
            <form
              className="border-t bg-card p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const prompt = String(formData.get("prompt") ?? "").trim();

                if (prompt.length > 0 || attachedScreenshots.length > 0) {
                  const messageText = createVisualSelectionPrompt(prompt, selectedElements);

                  // Auto-create checkpoint before sending
                  const messageIds = chat.messages
                    .filter((m) => m.role === "user" || m.role === "assistant")
                    .map((m) => m.id);
                  const hash = await createFileSnapshot(projectId);

                  saveCheckpoint(`Prompt ${checkpoints.length + 1}`, messageIds, hash, false);

                  void chat.sendMessage({
                    text: messageText,
                    files: attachedScreenshots.map((s) => ({
                      type: "file" as const,
                      mediaType: "image/png",
                      filename: s.filename ?? s.id,
                      url: s.serverPath,
                    })),
                  });
                  form.reset();
                  clearScreenshots();
                  clearSelectedElements();
                }
              }}
            >
              {selectedElements.length > 0 ? (
                <div aria-live="polite" className="mb-3 max-h-48 overflow-y-auto rounded-md border bg-secondary/60 p-3 text-xs text-secondary-foreground">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-foreground">Targets ({selectedElements.length})</span>
                    <Button onClick={() => { clearSelectedElements(); clearScreenshots(); }} size="sm" type="button" variant="ghost">
                      Clear all
                    </Button>
                  </div>
                  {selectedElements.map((el) => (
                    <label key={el.preferredSelector} className="flex cursor-pointer items-center gap-2 rounded-md bg-background/60 px-3 py-2 transition hover:bg-background">
                      <input
                        checked
                        className="size-4 accent-primary"
                        onChange={() => removeSelectedElement(el.preferredSelector)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="break-all font-medium text-foreground">{getClassNameLabel(el)}</span>
                        <span className="ml-2 break-all text-muted-foreground">{getClassNameSelector(el) ?? getPreferredSelector(el)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              {attachedScreenshots.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachedScreenshots.map((screenshot) => (
                    <div key={screenshot.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot.dataUrl}
                        alt={
                          screenshot.source === "inspector"
                            ? `Screenshot of ${screenshot.selector ?? "selected element"}`
                            : `Pasted image: ${screenshot.filename ?? "clipboard"}`
                        }
                        className="h-20 w-20 cursor-pointer rounded-md border object-cover"
                        onClick={() => setPreviewScreenshot(screenshot)}
                        title="Click to preview full size"
                      />
                      <button
                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition group-hover:opacity-100"
                        onClick={() => removeScreenshot(screenshot.id)}
                        type="button"
                        aria-label="Remove screenshot"
                      >
                        <X className="size-3" />
                      </button>
                      {screenshot.source === "inspector" && screenshot.selector ? (
                        <span className="mt-1 block max-w-[80px] truncate text-[10px] text-muted-foreground">
                          {screenshot.selector}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {chat.error ? (
                <p className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="status">
                  <AlertTriangle className="size-3" /> {chat.error.message || "Hermes is offline or unreachable. Check the Hermes service, then send again."}
                </p>
              ) : null}
              <textarea
                aria-label="Prompt Hermes"
                className="min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                disabled={chatBusy}
                name="prompt"
                onPaste={handleClipboardPasteStable}
                placeholder="Describe the next change..."
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button aria-busy={chatBusy} disabled={chatBusy} size="icon" title={chatBusy ? "Sending prompt" : "Send prompt"}>
                  {chatBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {chatBusy ? null : <SendHorizontal className="size-4" />}
                  <span className="sr-only">{chatBusy ? "Sending prompt" : "Send prompt"}</span>
                </Button>
                <Button
                  disabled={!chatBusy}
                  onClick={() => {
                    chat.stop();
                    void fetch("/api/chat/cancel", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId }),
                    });
                  }}
                  size="icon"
                  title="Stop prompt"
                  type="button"
                  variant="outline"
                >
                  <Square className="size-4" />
                  <span className="sr-only">Stop prompt</span>
                </Button>
              </div>
            </form>
          </section>
        </Panel>
        <Separator aria-label="Resize chat and preview panels" className="group flex w-3 items-center justify-center bg-border transition hover:bg-primary focus:outline-none focus:ring-2 focus:ring-ring" id="builder-main-splitter">
          <span className="h-10 w-1 rounded-full bg-muted-foreground/50 group-hover:bg-primary-foreground" />
        </Separator>
        <Panel collapsedSize={0} collapsible defaultSize={initialLayout.preview} id="preview" minSize={32} panelRef={previewPanelRef}>
          <section className="flex h-full flex-col bg-background">
            <div className="flex min-h-12 items-center justify-between border-b bg-card px-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-medium">Preview</span>
                <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                  {runtimeStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => chatPanelRef.current?.collapse()} size="icon" type="button" variant="outline">
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Collapse chat panel</span>
                </Button>
                <Button onClick={() => chatPanelRef.current?.expand()} size="icon" type="button" variant="outline">
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Expand chat panel</span>
                </Button>
                <span className="text-muted-foreground">{previewUrl}</span>
                <form action={restartRuntimeAction}>
                  <input name="projectId" type="hidden" value={projectId} />
                  <Button size="icon" type="submit" variant="outline">
                    <RotateCcw className="size-4" />
                    <span className="sr-only">Restart runtime</span>
                  </Button>
                </form>
                <form action={stopRuntimeAction}>
                  <input name="projectId" type="hidden" value={projectId} />
                  <Button disabled={runtimeStatus === "stopped"} size="icon" type="submit" variant="outline">
                    <Square className="size-4" />
                    <span className="sr-only">Stop runtime</span>
                  </Button>
                </form>
              </div>
            </div>
            <PreviewFrame
              defaultRoute={defaultRoute}
              key={projectId}
              previewUrl={previewUrl}
              projectId={projectId}
              projectName={projectName}
              runtimeLogs={displayedRuntimeLogs}
              runtimeLogsCollapsed={runtimeLogsCollapsed}
              runtimeStatus={runtimeStatus}
              onToggleRuntimeLogs={() => setRuntimeLogsCollapsed((collapsed) => !collapsed)}
            />
            {!runtimeLogsCollapsed ? (
              <div className="max-h-48 overflow-auto border-t bg-zinc-950 p-3 font-mono text-xs text-zinc-100" aria-label="Raw runtime logs" id="raw-runtime-logs">
                <div className="mb-2 flex flex-wrap gap-3 text-zinc-400">
                  <span>pid: {runtimePid ?? "none"}</span>
                  {runtimeStatus === "failed" ? <span>exit: {runtimeExitCode ?? runtimeExitSignal ?? "unknown"}</span> : null}
                </div>
                {displayedRuntimeLogs.length === 0 ? (
                  <p className="text-zinc-500">Runtime logs will appear here after the preview starts.</p>
                ) : (
                  displayedRuntimeLogs.map((entry) => (
                    <p key={`${entry.timestamp}-${entry.stream}-${entry.message}`} className="whitespace-pre-wrap">
                      <span className="text-zinc-500">{entry.timestamp}</span>{" "}
                      <span className={entry.stream === "stderr" ? "text-red-300" : "text-emerald-300"}>{entry.stream}</span>{" "}
                      {entry.message}
                    </p>
                  ))
                )}
              </div>
            ) : null}
          </section>
        </Panel>
      </Group>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>
              Runtime, package policy, validation, route, and theme metadata for this project.
            </DialogDescription>
          </DialogHeader>
          <form action={updateProjectSettingsAction} className="space-y-4">
            <input name="projectId" type="hidden" value={projectId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Package policy
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  defaultValue={packageInstallPolicy}
                  name="packageInstallPolicy"
                >
                  <option value="auto">Install automatically</option>
                  <option value="ask">Ask before install</option>
                  <option value="never">Never install</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Validation depth
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  defaultValue={validationDepth}
                  name="validationDepth"
                >
                  <option value="quick">Quick</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Default route
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                defaultValue={defaultRoute}
                name="defaultRoute"
              />
            </label>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Project theme</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {themeOptions.map((theme) => (
                  <label key={theme.id} className="grid cursor-pointer gap-2 rounded-md border bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
                    <input className="sr-only" defaultChecked={theme.id === selectedThemeId} name="themeId" type="radio" value={theme.id} />
                    <span className="font-medium">{theme.name}</span>
                    <span className="text-xs text-muted-foreground">{theme.description}</span>
                    <span className="theme-card-preview" data-theme-id={theme.id}>
                      <span className="theme-preview-swatch theme-preview-primary" />
                      <span className="theme-preview-swatch theme-preview-secondary" />
                      <span className="theme-preview-swatch theme-preview-accent" />
                      <span className="theme-preview-swatch theme-preview-background" />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-2 text-sm font-medium">
              Custom shadcn tokens
              <textarea
                className="min-h-28 resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                name="customThemeCss"
                placeholder=":root { ... }&#10;&#10;.dark { ... }"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input defaultChecked={autoStartPreview} name="autoStartPreview" type="checkbox" />
              Auto-start preview when opening this project
            </label>
            <Button className="w-full" type="submit">
              Save settings
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewScreenshot !== null} onOpenChange={(open) => { if (!open) setPreviewScreenshot(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100dvw-2rem)] p-2">
          {previewScreenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={
                previewScreenshot.source === "inspector"
                  ? `Screenshot of ${previewScreenshot.selector ?? "selected element"}`
                  : `Pasted image: ${previewScreenshot.filename ?? "clipboard"}`
              }
              className="max-h-[calc(100dvh-5rem)] w-full rounded-md object-contain"
              src={previewScreenshot.dataUrl}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function HermesActivityCards({ message }: { message: BuilderChatMessage }) {
  const activities = message.parts.flatMap((part) => (part.type === "data-hermes-activity" ? [part.data] : []));
  const groups = groupHermesActivities(activities);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2" aria-label="Hermes activity summary">
      {groups.map((group) => (
        <details key={`${message.id}-${group.title}`} className="rounded-md border bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <summary className="cursor-pointer font-semibold">
            {group.title} · {group.count} {group.count === 1 ? "action" : "actions"}
            <span className={group.status === "failed" ? "ml-2 text-destructive" : "ml-2 text-muted-foreground"}>{group.status}</span>
          </summary>
          {group.details.length > 0 ? (
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {group.details.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No detailed paths reported.</p>
          )}
        </details>
      ))}
    </div>
  );
}
