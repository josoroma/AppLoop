---
name: chat-checkpoints
description: "Use when working with AppLoop's chat checkpoint system: auto-save, git file snapshots, edit & resend, new session, DB persistence, and state restoration."
version: 2.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [checkpoints, git, rollback, state-restoration, edit-resend, db-persistence, sessions]
    related_skills: [visual-selector, generated-app-standards, project-runtime]
---

# Chat Checkpoints

## Overview

The builder automatically creates checkpoints on every prompt submit. Each checkpoint captures the conversation state (messages, inspect-mode targets, screenshots) and a git commit hash in the generated project workspace for file-level rollback on restore.

**Session boundaries** mark logical groupings of checkpoints. Only sessions appear in the history dropdown; individual prompt checkpoints are hidden from the UI. Sessions store **full message snapshots** so that restoring a session shows exactly the messages that existed when it was created, even after the chat was cleared.

All checkpoints are persisted to the SQLite database (`chat_checkpoints` table) and loaded on project page mount.

## When to Use

- Adding or modifying checkpoint behavior in builder-shell.tsx or chat-checkpoints.tsx
- Debugging checkpoint restore failures (messages not truncated, files not reverted)
- Working with the session boundary system (isSessionBoundary, message snapshots)
- Understanding DB persistence and initial load flow

## Architecture

### Prompt Submit (auto-checkpoint)

```
User presses Send
  │
  ├─► createFileSnapshot(projectId)  ← git add -A && git commit
  │
  ├─► saveCheckpoint("Prompt N", messageIds, hash, false)  ← hidden from UI
  │
  └─► chat.sendMessage(...)
```

### New Session

```
User clicks "New session"
  │
  ├─► Capture current messages as MessageSnapshot[]
  ├─► saveCheckpoint("Session N", messageIds, hash, true, messageSnapshots)
  ├─► Remove non-session checkpoints (isSessionBoundary: false)
  ├─► chat.setMessages([])
  └─► clearSelectedElements(), clearScreenshots()
```

### Session Restore (via history dropdown)

```
User clicks session in history
  │
  ├─► revertToFileSnapshot(projectId, cp.commitHash)  ← git reset --hard
  │
  ├─► If cp.messages.length > 0:
  │      chat.setMessages(reconstruct from MessageSnapshot[])
  │      (works even when current chat is empty)
  │
  └─► loadCheckpoint(cp.id) — restores targets + screenshots
```

### After Each Hermes Response (session persistence)

```
chat.status goes from "streaming" → "ready"
  │
  ├─► restartRuntimeAction(formData)   ← full restart for CSS hot reload
  │     (restartRuntimeAction kills the old Next.js process and
  │      starts a fresh one — more reliable than iframe reload
  │      for picking up CSS changes from Hermes file writes)
  │
  └─► Capture current chat.messages as MessageSnapshot[]
      Persist to current session boundary checkpoint via updateCheckpointMessages()
```

This ensures session state is durable across page refreshes — the current session's messages are saved after every prompt.

### Edit & Resend (Restore + Edit as separate buttons)

```
User clicks "Edit & Resend" on a past user message
  │
  ├─► Find checkpoint with matching messageIds
  ├─► revertToFileSnapshot → truncate chat → restore targets/screenshots
  └─► Pre-fill textarea with original prompt (splits on "Target classnames")
```

## Types

```ts
export type MessageSnapshot = {
  id: string;
  role: "user" | "assistant";
  content: string;  // getMessageText() output
};

export type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;         // epoch ms
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];
  commitHash: string | null;
  isSessionBoundary: boolean; // true → visible in history, false → hidden
  messages: MessageSnapshot[]; // only populated on session boundaries
};
```

## Store API

| Method | Signature | Description |
|--------|-----------|-------------|
| `saveCheckpoint` | `(name, messageIds, commitHash?, isSessionBoundary?, messages?)` | Creates checkpoint, triggers DB upsert |
| `loadCheckpoint` | `(id) => ChatCheckpoint?` | Returns cp and restores targets/screenshots |
| `removeCheckpoint` | `(id)` | Removes from store + DB via `deleteChatCheckpoint` |
| `setCheckpoints` | `(checkpoints[])` | Full replace (used on initial DB load) |
| `updateCheckpointMessages` | `(id, messages: MessageSnapshot[])` | Updates messages + messageIds for a checkpoint (used when saving current session before switching) |
| `checkpoints` | `ChatCheckpoint[]` | Read-only array |

## DB Persistence

Table: `chat_checkpoints` (see `lib/db/schema.ts`)

| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | e.g. "cp-1721000000-1" |
| projectId | text (FK) | Project reference |
| name | text | Display name |
| isSessionBoundary | boolean | 1 for sessions, 0 for auto-checkpoints |
| dataJson | text | Full ChatCheckpoint as JSON |
| createdAt | integer | Epoch ms |

**Load on mount**: `listChatCheckpoints(projectId)` → `JSON.parse(dataJson)` → `setCheckpoints()`.
Timestamp conversion: DB returns `createdAt` as a number (Drizzle `timestamp_ms` mode). Use `Number(row.createdAt)` when hydrating.

**Save**: Every `saveCheckpoint` triggers `saveChatCheckpoint(id, projectId, name, isSessionBoundary, JSON.stringify(cp))` via a useEffect watching `checkpoints`.

**Delete**: `removeCheckpoint` calls `deleteChatCheckpoint(id)` directly from the store action.

Server actions: `lib/chat/checkpoint-actions.ts`

## Git File Snapshots

Server actions in `lib/chat/file-snapshot.ts`:

- `createFileSnapshot(projectId)` — `git add -A && git commit --allow-empty`. Auto-inits git if needed. Returns hash or null.
- `revertToFileSnapshot(projectId, commitHash)` — `git reset --hard <hash> && git clean -fd`. Discards ALL uncommitted changes.

## Component Structure

| File | Role |
|------|------|
| `chat-checkpoints.tsx` | "New" button + session history dropdown trigger + latest session indicator |
| `session-history.tsx` | Portal-rendered paginated dropdown (only shows isSessionBoundary entries) |
| `use-builder-ui-store.ts` | Checkpoint state, DB sync, remove → deleteChatCheckpoint |
| `builder-shell.tsx` | Auto-checkpoint on submit, edit & resend, new session, DB load/restore |
| `lib/chat/checkpoint-actions.ts` | Server actions: list, save, delete |
| `lib/chat/file-snapshot.ts` | Server actions: git commit, git reset |
| `lib/db/schema.ts` | `chatCheckpoints` table |

## Pitfalls

- **useChat id IS the API projectId**: DO NOT append sessionKey to the useChat id. The hook sends body.id to /api/chat, and the route uses it as projectId for requireProjectAccess(). A mangled ID like projectId-0 fails with "Project access denied". Session isolation uses chat.setMessages([]) on new session and chat.setMessages(snapshots) on restore — never separate useChat instances.

- **Per-project checkpoint loading**: On project switch, setCheckpoints([]) must be called FIRST to clear stale data, then checkpointsLoadedRef.current = false to prevent the sync effect from firing during load. After loading completes, set the ref back to true. The sync effect (saveChatCheckpoint) guards with if (!checkpointsLoadedRef.current) return to avoid saving old-project checkpoints to the new project DB.

- **SQLite foreign keys OFF by default**: Add PRAGMA foreign_keys = ON in createDatabaseClient() (lib/db/index.ts). Without it, cascade deletes on chat_checkpoints.project_id don't execute when projects are deleted. Manual cleanup: DELETE FROM chat_checkpoints WHERE project_id NOT IN (SELECT id FROM projects).

- **Session vs checkpoint**: Only isSessionBoundary: true entries appear in history. Prompt checkpoints exist only for edit/resend rollback. The chips (Prompt 1, etc.) are NOT rendered in the UI.

- **Message snapshots enable cross-session restore**: `messages: MessageSnapshot[]` stores full content at session creation. When restoring, `chat.setMessages()` reconstructs from snapshots — works even when current chat is empty. Without snapshots, restoring would show 0 messages.

- **New session clears non-session checkpoints only**: `cp.isSessionBoundary && removeCheckpoint(cp.id)` — session boundaries persist across new sessions.

- **Async form handler**: Capture `const form = event.currentTarget` BEFORE `await createFileSnapshot()`. React nulls synthetic events after async calls.

- **Timestamp conversion**: DB `createdAt` is a number (Drizzle `timestamp_ms`). Convert to store type with `Number(row.createdAt)`.

- **Runtime restart for CSS hot reload**: After Hermes writes CSS files, Turbopack may serve stale compiled output even with CHOKIDAR_USEPOLLING. Use `restartRuntimeAction` (full kill + start) instead of iframe reload (`previewReloadKey`) to guarantee CSS changes are picked up. Restart runs in the same useEffect that captures session messages after each Hermes response.

- **Separate Restore and Edit buttons**: Each user message has two inline buttons. \"Restore\" reverts files/messages/targets without pre-filling the textarea. \"Edit\" also pre-fills the textarea. Both are wrapped in a `<div>` (not inside `<p>` to avoid \"div cannot be a descendant of p\" hydration errors).
