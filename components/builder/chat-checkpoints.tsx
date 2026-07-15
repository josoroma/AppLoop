"use client";

import { BookmarkCheck, Plus, X } from "lucide-react";
import { useBuilderUiStore } from "@/components/builder/use-builder-ui-store";
import { SessionHistory } from "@/components/builder/session-history";
import { revertToFileSnapshot } from "@/lib/chat/file-snapshot";
import type { ChatCheckpoint as CheckpointType } from "@/components/builder/use-builder-ui-store";

type ChatCheckpointsProps = {
  projectId: string;
  onRestore: (messageIds: string[]) => void;
  onRestoreCheckpoint: (cp: CheckpointType) => void;
  onNewSession: () => void;
};

export function ChatCheckpoints({ projectId, onRestore, onRestoreCheckpoint, onNewSession }: ChatCheckpointsProps) {
  const checkpoints = useBuilderUiStore((s) => s.checkpoints);
  const loadCheckpoint = useBuilderUiStore((s) => s.loadCheckpoint);
  const removeCheckpoint = useBuilderUiStore((s) => s.removeCheckpoint);
  const latest = checkpoints[checkpoints.length - 1] ?? null;

  async function handleRestore(cpId: string) {
    const cp = loadCheckpoint(cpId);

    if (!cp) return;

    if (cp.commitHash) {
      await revertToFileSnapshot(projectId, cp.commitHash);
    }

    onRestore(cp.messageIds);
  }

  async function handleNewSession() {
    // Restore to first checkpoint's file state if it exists
    const firstCp = checkpoints[0];

    if (firstCp?.commitHash) {
      await revertToFileSnapshot(projectId, firstCp.commitHash);
    }

    onNewSession();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {checkpoints.map((cp) => (
            <button
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              key={cp.id}
              onClick={() => handleRestore(cp.id)}
              title={cp.commitHash ? `Restore "${cp.name}" (${cp.commitHash.slice(0, 7)})` : `Restore "${cp.name}"`}
              type="button"
            >
              <BookmarkCheck className="size-3 text-primary" />
              {cp.name}
              <span
                className="ml-0.5 inline-flex cursor-pointer rounded-full p-0.5 hover:bg-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCheckpoint(cp.id);
                }}
                title="Delete checkpoint"
              >
                <X className="size-2.5" />
              </span>
            </button>
          ))}
        </div>

        <button
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          onClick={handleNewSession}
          title="Start a clean session with no history"
          type="button"
        >
          <Plus className="size-3" />
          New
        </button>
        <SessionHistory projectId={projectId} onRestore={onRestoreCheckpoint} />
      </div>

      {latest && (
        <span className="text-[10px] text-muted-foreground/60">
          Latest: {latest.name}
        </span>
      )}
    </div>
  );
}