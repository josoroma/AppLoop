# Chat Checkpoints

The builder supports saving and restoring conversation checkpoints. Checkpoints are created **automatically on every prompt submit** and snapshot: chat messages, inspect mode targets, screenshots, and a git commit of the generated project files. No manual save needed — the auto-checkpoint covers every state transition.

## Architecture

### Store (`use-builder-ui-store.ts`)

```typescript
export type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];
  commitHash: string | null; // git commit for file rollback
};
```

**Actions**:
- `saveCheckpoint(name, messageIds, commitHash?)` — snapshots current targets, screenshots, message IDs, and optionally a git commit hash
- `loadCheckpoint(id)` — restores targets and screenshots to the store, returns the checkpoint for message restore + file revert
- `removeCheckpoint(id)` — removes a single checkpoint

### Auto-Checkpoint on Prompt Submit

Every prompt submission automatically creates a checkpoint BEFORE sending. Flow in `builder-shell.tsx`:

```typescript
onSubmit={async (event) => {
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (prompt.length > 0 || attachedScreenshots.length > 0) {
    // 1. Snapshot message IDs
    const messageIds = chat.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => m.id);
    // 2. Git snapshot
    const hash = await createFileSnapshot(projectId);
    // 3. Save
    saveCheckpoint(`Prompt ${checkpoints.length + 1}`, messageIds, hash);
    // 4. Send
    void chat.sendMessage({ text: messageText, files: [...] });
  }
}}
```

### Git-Based File Snapshots (`lib/chat/file-snapshot.ts`)

Server actions in the generated project workspace:
- `createFileSnapshot(projectId)` — `git add -A && git commit`, auto-inits git. Returns short hash or null.
- `revertToFileSnapshot(projectId, commitHash)` — `git reset --hard <hash> && git clean -fd`. Returns boolean.

## Component (`chat-checkpoints.tsx`)

Renders above the conversation inside `border-b px-4 py-2`.

**Props**:
- `projectId: string`
- `onRestore: (messageIds: string[]) => void` — called when a chip is clicked
- `onRestoreCheckpoint: (cp: ChatCheckpoint) => void` — called from session history panel; handles full restore (messages + targets + screenshots)
- `onNewSession: () => void` — called when "New" button clicked

**UI elements**:
- **Checkpoint chips**: `rounded-full border bg-card` pills with bookmark icon, name, and delete × button
- **"New" button**: Clears all checkpoints, resets `chat.setMessages([])`, clears selections and screenshots. Restores project files to the first checkpoint's commit hash if one exists.
- **"Sessions (N)" button**: Opens the `SessionHistory` dropdown panel
- **"Latest: <name>"** indicator below the row

## Session History (`session-history.tsx`)

A dropdown panel that shows all checkpoints as a paginated list (8 per page). Rendered via `createPortal(children, document.body)` to avoid clipping by parent `overflow-hidden` containers:

- Positioning: `getBoundingClientRect()` on a button ref → `fixed` with `left` + `top`
- Z-index: backdrop `z-[60]`, panel `z-[61]`
- Each entry shows: checkpoint name, relative timestamp (`"3m ago"`), message count, target count, and short commit hash
- Click an entry → reverts files to commit, restores messages via `onRestoreCheckpoint`, closes panel
- Pagination controls: ← Newer / Older → with page counter
- Closed by clicking outside (fixed `inset-0` overlay) or the ✕ button

## Edit & Resend

Every past user message has an "Edit & Resend" button. Clicking it:

1. Finds the checkpoint created before this prompt: `checkpoints.findIndex(cp => cp.messageIds.includes(message.id))`
2. Reverts files if the checkpoint has a `commitHash` → `revertToFileSnapshot(projectId, cp.commitHash)`
3. Truncates messages → `chat.setMessages(chat.messages.filter(m => idSet.has(m.id)))`
4. Restores targets/screenshots → `loadCheckpoint(cp.id)`
5. Pre-fills the textarea with the original prompt text (up to "Target classnames")

Fallback: if no checkpoint found, truncates to before the message without file reversion.

## New Session

The "New" button replaces the old manual "Save checkpoint" button (now unnecessary since every prompt auto-creates checkpoints). Flow:

1. If a first checkpoint exists with a `commitHash`, calls `revertToFileSnapshot(projectId, firstCp.commitHash)` to reset project files
2. Removes all checkpoints from the store
3. Calls `chat.setMessages([])` to clear conversation
4. Clears selected elements and screenshots
5. Hermes context is effectively reset (no messages to inherit)

## Hermes Context Usage (`hermes-context-usage.tsx`)

Displays below the checkpoints bar when messages exist:

- **Message count**: "N messages in context"
- **Token bar** (when context window + consumed token data available): progress bar in green → yellow → red as context fills
- **Compaction indicator**: yellow "Context was compacted"
- **Truncation indicator**: red "Context was truncated"

Props:
```typescript
type HermesContextUsageProps = {
  contextWindow?: number;
  consumedTokens?: number;
  compacted?: boolean;
  truncated?: boolean;
  messageCount?: number;
};
```

Currently shows `messageCount` only — token data and compaction/truncation flags will be populated once Hermes provides that metadata in responses.

## Key Files

| File | Role |
|------|------|
| `components/builder/chat-checkpoints.tsx` | Checkpoint chips, New session, Sessions button |
| `components/builder/session-history.tsx` | Paginated history dropdown |
| `components/builder/hermes-context-usage.tsx` | Context usage display |
| `components/builder/use-builder-ui-store.ts` | ChatCheckpoint type + store actions |
| `components/builder/builder-shell.tsx` | Integration (auto-checkpoint, edit-resend, restore) |
| `lib/chat/file-snapshot.ts` | Git-based file snapshot server actions |
