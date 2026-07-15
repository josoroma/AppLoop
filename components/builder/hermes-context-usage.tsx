"use client";

type HermesContextUsageProps = {
  /** Current context window size in tokens (total available) */
  contextWindow?: number;
  /** Tokens consumed so far */
  consumedTokens?: number;
  /** Whether context compaction occurred */
  compacted?: boolean;
  /** Whether context was truncated */
  truncated?: boolean;
  /** Number of messages in the current context */
  messageCount?: number;
};

export function HermesContextUsage({
  contextWindow,
  consumedTokens,
  compacted,
  messageCount,
  truncated,
}: HermesContextUsageProps) {
  const hasData = contextWindow != null && consumedTokens != null;
  const pct = hasData && contextWindow > 0 ? Math.round((consumedTokens / contextWindow) * 100) : 0;

  return (
    <div className="space-y-1 text-[10px] text-muted-foreground/60">
      {hasData && (
        <>
          <div className="flex items-center justify-between">
            <span>Context</span>
            <span>
              {consumedTokens?.toLocaleString()} / {contextWindow?.toLocaleString()} tokens
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${
                pct > 90 ? "bg-destructive" : pct > 70 ? "bg-yellow-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </>
      )}
      {messageCount != null && (
        <div>
          {messageCount} message{messageCount !== 1 ? "s" : ""} in context
        </div>
      )}
      {compacted && <div className="text-yellow-500">Context was compacted</div>}
      {truncated && <div className="text-destructive">Context was truncated</div>}
    </div>
  );
}