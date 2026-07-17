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

Each past user message has a **Restore** and **Edit** button. Both follow the same flow:

1. Find the checkpoint whose `messageIds` include this message's ID
2. If `commitHash` exists: `revertToFileSnapshot(projectId, commitHash)` — `git reset --hard <hash>` + `git clean -fd`
3. Truncate chat to checkpoint message IDs: `chat.setMessages(messages.filter(m => idSet.has(m.id)))`
4. `loadCheckpoint(cp.id)` — restore targets + screenshots
5. **Edit only**: pre-fill textarea with original prompt (stripping "Target classnames" suffix)
6. **`setPreviewReloadKey(k => k + 1)`** — force iframe remount so the preview shows reverted state

The preview reload is critical: `git reset --hard` changes many files atomically, and the Next.js dev server's file watchers often miss this. The iframe's `key` prop (`key={frameSrc-reloadKey}` in `preview-frame.tsx`) forces React to unmount/remount on key change.

## Async Form Handler Pitfall

When `onSubmit` is `async`, React nulls synthetic events after any `await`. Always capture `event.currentTarget` before the first `await`:

```typescript
// CORRECT
const form = event.currentTarget;  // ← capture before await
const hash = await createFileSnapshot(projectId);
form.reset();  // ← uses captured reference
```

## Per-Project Session Isolation

Checkpoints are stored per-project in the database (`chat_checkpoints.project_id` FK). The builder-shell enforces isolation:

```typescript
// On project switch: clear stale data immediately, then fetch new project's checkpoints
useEffect(() => {
  setCheckpoints([]);                    // ← prevent flash of old project's data
  checkpointsLoadedRef.current = false;   // ← block sync effect during load
  void (async () => {
    const rows = await listChatCheckpoints(projectId);
    setCheckpoints(rows.map(row => ({...parse(row.dataJson), ...})));
    checkpointsLoadedRef.current = true;  // ← re-enable sync
  })();
}, [projectId]);
```

The sync effect is guarded to prevent saving old checkpoints to a new project:

```typescript
useEffect(() => {
  if (!checkpointsLoadedRef.current) return;  // ← skip during load transition
  for (const cp of checkpoints) {
    void saveChatCheckpoint(cp.id, projectId, cp.name, cp.isSessionBoundary, JSON.stringify(cp));
  }
}, [checkpoints, projectId]);
```

**DB cascading**: `PRAGMA foreign_keys = ON` is set in `createDatabaseClient()` so deleting a project cascade-deletes its checkpoints. Without this, SQLite does not enforce foreign key cascades by default.

## Session-Isolated Chat Instances

Each session gets its own isolated `useChat` instance via a `sessionKey`:

```typescript
const [sessionKey, setSessionKey] = useState(0);
const chat = useChat({ id: `${projectId}-${sessionKey}`, ... });
```

When "New session" is clicked, `setSessionKey(k => k + 1)` changes the chat ID, forcing `useChat` to create a fresh instance with no messages — this replaces `chat.setMessages([])` which doesn't fully clear persisted state.

## Hermes Session Sync (`/new --yes`)

When a new UI session is created, a Hermes command is sent via the chat to sync the backend session:

```typescript
// In the "New session" handler:
sessionCommandRef.current = `/new --yes Session ${sessionNum}`;
setSessionKey(k => k + 1);

// useEffect sends the command when the new chat instance mounts:
useEffect(() => {
  if (sessionCommandRef.current) {
    const cmd = sessionCommandRef.current;
    sessionCommandRef.current = null;
    void chat.sendMessage({ text: cmd });
  }
}, [sessionKey]);
```

This tells Hermes to start a fresh session context. Hermes returns a new session ID via the `session` event, which the chat route stores in `projects.hermesSessionId`.
