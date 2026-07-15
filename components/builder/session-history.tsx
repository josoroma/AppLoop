"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, History } from "lucide-react";
import { useBuilderUiStore, type ChatCheckpoint } from "@/components/builder/use-builder-ui-store";
import { revertToFileSnapshot } from "@/lib/chat/file-snapshot";

type SessionHistoryProps = {
  projectId: string;
  onRestore: (checkpoint: ChatCheckpoint) => void;
};

const PAGE_SIZE = 8;

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);

  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getPromptPreview(checkpoint: ChatCheckpoint) {
  return checkpoint.name || `Checkpoint ${checkpoint.id.slice(0, 7)}`;
}

export function SessionHistory({ projectId, onRestore }: SessionHistoryProps) {
  const checkpoints = useBuilderUiStore((s) => s.checkpoints);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const totalPages = Math.max(1, Math.ceil(checkpoints.length / PAGE_SIZE));
  const paged = checkpoints.slice(-(page + 1) * PAGE_SIZE, -(page * PAGE_SIZE) || undefined);

  async function handleRestore(cp: ChatCheckpoint) {
    if (cp.commitHash) {
      await revertToFileSnapshot(projectId, cp.commitHash);
    }

    onRestore(cp);
    setOpen(false);
  }

  function getDropdownPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return {};

    return {
      left: rect.left,
      top: rect.bottom + 4,
    };
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
        ref={buttonRef}
        type="button"
      >
        <History className="size-3.5" />
        Sessions ({checkpoints.length})
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[61] w-72 rounded-lg border bg-card shadow-lg"
              style={getDropdownPosition()}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-semibold text-foreground">Session history</span>
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {paged.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No sessions yet</p>
                ) : (
                  paged.map((cp) => (
                    <button
                      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 last:border-b-0"
                      key={cp.id}
                      onClick={() => handleRestore(cp)}
                      type="button"
                    >
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{getPromptPreview(cp)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatTime(cp.createdAt)} · {cp.messageIds.length} messages · {cp.targets.length} targets
                          {cp.commitHash ? ` · ${cp.commitHash.slice(0, 7)}` : ""}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-3 py-1.5">
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    type="button"
                  >
                    ← Newer
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    type="button"
                  >
                    Older →
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}