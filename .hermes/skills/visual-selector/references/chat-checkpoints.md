# Chat Checkpoints & Sessions

The builder supports saving and restoring conversation checkpoints. Checkpoints are created **automatically on every prompt submit** (for edit/resend rollback) and are hidden from the session history UI. **Sessions** are user-initiated boundaries (via "New session") that appear in the session history dropdown and allow switching between logical conversation groups.

## Core Concepts

- **Checkpoint** (`isSessionBoundary: false`) — auto-created on every prompt. Used only for Edit & Resend rollback. NOT shown in session history or as UI pills.
- **Session** (`isSessionBoundary: true`) — created via "New session" button. Stores full `MessageSnapshot[]` for reliable restore. Visible in session history dropdown.

## Architecture

### Store (`use-builder-ui-store.ts`)

```typescript
export type MessageSnapshot = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];
  commitHash: string | null;
  isSessionBoundary: boolean;          // true = visible in session history
  messages: MessageSnapshot[];          // full snapshots (only on session boundaries)
};
```

**Actions**:
- `saveCheckpoint(name, messageIds, commitHash?, isSessionBoundary?, messages?)` — snapshots state
- `loadCheckpoint(id)` — restores targets/screenshots to store, returns checkpoint
- `removeCheckpoint(id)` — removes one checkpoint

### Auto-Checkpoint on Prompt Submit

Every prompt automatically creates a checkpoint (NOT a session boundary). Flow in `builder-shell.tsx`:

```typescript
onSubmit={async (event) => {
  const form = event.currentTarget; // capture before await (React synthetic event quirk)
  // ...
  const messageIds = chat.messages.filter(...).map(m => m.id);
  const hash = await createFileSnapshot(projectId);
  saveCheckpoint(`Prompt ${checkpoints.length + 1}`, messageIds, hash, false); // isSessionBoundary=false
  chat.sendMessage(...);
}}
```

### Session Creation ("New session" button)

Only creates a session boundary checkpoint when the user clicks "New session":

```typescript
onNewSession={async () => {
  const currentMessages = chat.messages.filter(...);
  const messageIds = currentMessages.map(m => m.id);
  const messageSnapshots = currentMessages.map(m => ({
    id: m.id, role: m.role, content: getMessageText(m)
  }));
  const hash = await createFileSnapshot(projectId);
  saveCheckpoint(`Session ${sessionNum}`, messageIds, hash, true, messageSnapshots);
  // Clean up non-boundary checkpoints from previous session
  useBuilderUiStore.getState().checkpoints.forEach(
    cp => !cp.isSessionBoundary && useBuilderUiStore.getState().removeCheckpoint(cp.id)
  );
  chat.setMessages([]);
  clearSelectedElements();
  clearScreenshots();
}}
```

### Session Restore

When a session is clicked in the history dropdown, messages are restored from the stored `MessageSnapshot[]`:

```typescript
onRestoreCheckpoint={(cp) => {
  if (cp.messages.length > 0) {
    chat.setMessages(cp.messages.map(m => ({
      id: m.id, role: m.role,
      parts: [{ type: "text" as const, text: m.content }],
    } as BuilderChatMessage)));
  } else {
    // Fallback for legacy checkpoints without message snapshots
    const idSet = new Set(cp.messageIds);
    chat.setMessages(chat.messages.filter(m => idSet.has(m.id)));
  }
  loadCheckpoint(cp.id);
}}
```

**Why full message snapshots are needed**: After "New session" calls `chat.setMessages([])`, the stored `messageIds` refer to deleted messages that no longer exist in the current chat. Filtering `chat.messages` by stored IDs produces an empty result. Storing `MessageSnapshot[]` (id + role + content) allows reconstructing the messages even after they've been cleared.

## Component (`chat-checkpoints.tsx`)

Renders above the conversation as a single row: "New" button + Sessions dropdown + latest session indicator. NO checkpoint pills — those are hidden from the UI.

**Props**:
- `projectId: string`
- `onRestoreCheckpoint: (cp: ChatCheckpoint) => void` — restores messages + targets + screenshots
- `onNewSession: () => void` — creates session boundary, clears conversation

**UI**:
```
[+ New]  [Sessions (2)]  🕐 Session 2
```

The latest session name is shown on desktop (`hidden sm:inline-flex`), hidden on mobile.

## Session History (`session-history.tsx`)

Shows ONLY `isSessionBoundary: true` checkpoints (session boundaries), paginated 8 per page.

```typescript
const sessionCheckpoints = checkpoints.filter(cp => cp.isSessionBoundary);
```

Portal-rendered to `document.body` to avoid overflow clipping.

## Edit & Resend

Each past user message has an "Edit & Resend" button. Clicking restores to the checkpoint BEFORE that prompt (non-boundary, auto-created), reverts files, truncates chat, pre-fills textarea. Uses stored `messageIds` for ID-based filtering since non-boundary checkpoints don't store full message snapshots.

## Async Form Handler Pitfall

When `onSubmit` is `async`, React nulls synthetic events after any `await`. Always capture `event.currentTarget` before the first `await`:

```typescript
// CORRECT
const form = event.currentTarget;  // ← capture before await
const hash = await createFileSnapshot(projectId);
form.reset();  // ← uses captured reference
```
