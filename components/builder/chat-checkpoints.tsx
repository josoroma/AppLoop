"use client";

import { Clock, Plus } from "lucide-react";
import { useBuilderUiStore } from "@/components/builder/use-builder-ui-store";
import { SessionHistory } from "@/components/builder/session-history";
import type { ChatCheckpoint as CheckpointType } from "@/components/builder/use-builder-ui-store";

type ChatCheckpointsProps = {
  projectId: string;
  onRestoreCheckpoint: (cp: CheckpointType) => void;
  onNewSession: () => void;
};

export function ChatCheckpoints({ projectId, onRestoreCheckpoint, onNewSession }: ChatCheckpointsProps) {
  const checkpoints = useBuilderUiStore((s) => s.checkpoints);
  const sessions = checkpoints.filter((cp) => cp.isSessionBoundary);
  const latest = sessions[sessions.length - 1] ?? null;

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        onClick={onNewSession}
        title="Start a clean session with no history"
        type="button"
      >
        <Plus className="size-3" />
        New
      </button>

      <SessionHistory projectId={projectId} onRestore={onRestoreCheckpoint} />

      {latest && (
        <span className="hidden items-center gap-1 text-[10px] text-muted-foreground/60 sm:inline-flex">
          <Clock className="size-3" />
          {latest.name}
        </span>
      )}
    </div>
  );
}