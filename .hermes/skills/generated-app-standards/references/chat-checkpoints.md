# Chat Sessions, Checkpoints & Git Snapshots

## Architecture Overview

Two related but distinct concepts:

- **Checkpoint** — auto-created on every prompt submit, stores message IDs + git commit hash. Used for Edit & Resend rollback. `isSessionBoundary: false`. Not visible in session history.
- **Session** — created by "New session" button. Stores full `MessageSnapshot[]` for restoration. `isSessionBoundary: true`. Visible in session history dropdown.

No gateway commands (`/new`, `/resume`) are sent — the chat route handles Hermes session management automatically. Gateway sync was tried and removed because it caused "Project access denied" errors and conflicted with the route's built-in session ID management.

## DB Schema

```sql
CREATE TABLE chat_checkpoints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_session_boundary INTEGER DEFAULT FALSE,
  data_json TEXT NOT NULL,  -- full ChatCheckpoint JSON blob
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

Checkpoints are loaded from DB on mount (`listChatCheckpoints`) and synced on change (`saveChatCheckpoint`). Deletions call `deleteChatCheckpoint`. Enable `PRAGMA foreign_keys = ON` for cascade delete.

## Store Types

```typescript
export type MessageSnapshot = { id: string; role: "user" | "assistant"; content: string };

export type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];
  commitHash: string | null;
  isSessionBoundary: boolean;
  messages: MessageSnapshot[];
};
```

## Prompt Submit Flow

Every prompt submit creates an auto-checkpoint:

```
onSubmit:
  1. Capture messageIds from chat.messages (user+assistant roles)
  2. await createFileSnapshot(projectId) → git commit hash
  3. saveCheckpoint("Prompt N", messageIds, hash, false) → isSessionBoundary: false
  4. chat.sendMessage(...)
```

## New Session Flow

```
onNewSession:
  1. Capture currentMessages = chat.messages (user+assistant roles)
  2. Create MessageSnapshot[] from currentMessages
  3. await createFileSnapshot(projectId) → git commit hash
  4. saveCheckpoint("Session N", messageIds, hash, true, messageSnapshots) → isSessionBoundary: true
  5. chat.setMessages([]) → clear chat (same useChat instance, id: projectId)
  6. Clean up non-boundary checkpoints from store
```

## Session Restore Flow

```
onRestoreCheckpoint:
  1. Find latest session boundary (checkpoints.filter(isSessionBoundary).last)
  2. If switching to different session (currentSession.id !== cp.id):
     a. Save current session's messages: updateCheckpointMessages(currentSession.id, currentMsgs)
  3. chat.setMessages(cp.messages.map(m => ({id, role, parts: [{text: m.content}]})))
  4. loadCheckpoint(cp.id) → restore targets + screenshots
```

All sessions share the same `useChat` instance (`id: projectId`). Messages are stored as full `MessageSnapshot[]` in the checkpoint and restored via `chat.setMessages()`. The saved messages are complete at the moment "New session" is clicked, so restoring shows exactly those messages.

**Never use compound useChat IDs** like `${projectId}-${sessionKey}` — the `id` parameter is sent as `body.id` to the chat API route, which uses it as `projectId` for authorization. Compound IDs cause "Project access denied".

## Edit & Resend Flow

```
Edit & Resend button on user message:
  1. Find checkpoint whose messageIds includes this prompt's ID
  2. If checkpoint found:
     a. revertToFileSnapshot(projectId, cp.commitHash) → git reset --hard
     b. chat.setMessages(messages.filter(idSet.has(id))) → truncate
     c. loadCheckpoint(cp.id) → restore targets + screenshots
     d. Pre-fill textarea with original prompt (split at "Target classnames")
  3. If no checkpoint:
     a. chat.setMessages(messages.slice(0, idx)) → truncate
     b. Pre-fill textarea
```

## Git File Snapshots

Location: `lib/chat/file-snapshot.ts`

```typescript
createFileSnapshot(projectId): Promise<string | null>
// git add -A && git commit --allow-empty -m "checkpoint"
// Auto-initializes git if needed. Returns short hash or null.

revertToFileSnapshot(projectId, commitHash): Promise<boolean>
// git reset --hard <hash> && git clean -fd. Returns true on success.
```

## Per-Project Isolation

- DB scoped by `project_id` FK with cascade delete
- Store cleared (`setCheckpoints([])`) before loading new project
- `checkpointsLoadedRef` guards sync effect during transition
- `PRAGMA foreign_keys = ON` in DB client factory

## Session History UI

- Rendered via `createPortal` to `document.body` to avoid clipping by parent overflow containers
- Gated with `isClient` hydration check to avoid SSR `document is not defined`
- Paginated (PAGE_SIZE=8) with ← Newer / Older → navigation
- Shows session name, timestamp, message count, target count, commit hash
- Uses `position: fixed` with button ref `getBoundingClientRect()` for positioning
