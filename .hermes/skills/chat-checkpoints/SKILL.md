---
name: chat-checkpoints
description: "Use when working with AppLoop's chat checkpoint system: auto-save, git file snapshots, edit & resend, new session, and state restoration."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [checkpoints, git, rollback, state-restoration, edit-resend]
    related_skills: [visual-selector, generated-app-standards, project-runtime]
---

# Chat Checkpoints

## Overview

The builder automatically creates checkpoints on every prompt submit. Each checkpoint captures the conversation state (messages, inspect-mode targets, screenshots) and a git commit hash in the generated project workspace. This enables file-level rollback on restore.

## When to Use

- Adding or modifying checkpoint behavior in builder-shell.tsx or chat-checkpoints.tsx
- Debugging checkpoint restore failures (messages not truncated, files not reverted, targets not restored)
- Adding git-based file snapshots to a new project workflow
- Understanding the auto-checkpoint flow or edit & resend architecture

## Architecture

### Data Flow

```
User presses Send
  │
  ├─► createFileSnapshot(projectId)  ← server action: git add -A && git commit
  │     └─► returns commit hash (or null if git unavailable)
  │
  ├─► saveCheckpoint(name, messageIds, hash)  ← Zustand store
  │     └─► stores { id, name, targets, screenshots, messageIds, commitHash }
  │
  └─► chat.sendMessage(...)  ← sends prompt to Hermes
```

### Restore Flow (Edit & Resend)

```
User clicks "Edit & Resend" on a past user message
  │
  ├─► Find checkpoint whose messageIds include this message id
  │
  ├─► If checkpoint found:
  │     ├─► revertToFileSnapshot(projectId, commitHash)  ← git reset --hard
  │     ├─► chat.setMessages(messages up to checkpoint)
  │     ├─► loadCheckpoint(cp.id)  ← restores targets + screenshots
  │     └─► Pre-fill textarea with original prompt text
  │
  └─► If no checkpoint:
        ├─► Truncate messages to before this message
        └─► Pre-fill textarea
```

### New Session Flow

```
User clicks "New session"
  │
  ├─► Restore first checkpoint's file state (if exists)
  ├─► Remove all checkpoints from store
  ├─► chat.setMessages([])
  └─► clearSelectedElements(), clearScreenshots()
```

## Store API

The `useBuilderUiStore` Zustand store manages checkpoints:

| Method | Signature | Description |
|--------|-----------|-------------|
| `saveCheckpoint` | `(name, messageIds, commitHash?)` | Creates a new checkpoint with current state |
| `loadCheckpoint` | `(id) => ChatCheckpoint?` | Returns checkpoint and restores targets/screenshots |
| `removeCheckpoint` | `(id)` | Removes one checkpoint |
| `checkpoints` | `ChatCheckpoint[]` | Read-only array of all checkpoints |

`ChatCheckpoint` type:
```ts
type ChatCheckpoint = {
  id: string;           // e.g. "cp-1721000000000-1"
  name: string;         // e.g. "Prompt 3" or user-given name
  createdAt: number;    // Date.now() timestamp
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[]; // IDs of user + assistant messages at checkpoint time
  commitHash: string | null; // git commit hash for file rollback
};
```

## Git File Snapshots

Server actions in `lib/chat/file-snapshot.ts`:

- `createFileSnapshot(projectId)` — runs `git add -A && git commit --allow-empty` in the generated project's workspace. Auto-initializes git if needed. Returns commit hash or null.
- `revertToFileSnapshot(projectId, commitHash)` — runs `git reset --hard <hash> && git clean -fd`. Discards ALL uncommitted changes. Returns boolean success.

**Important**: These are server actions — they must be called via `await`. They operate on the generated project's filesystem, not the builder's.

## Component Structure

- `chat-checkpoints.tsx` — checkpoint chips, new session button, restore handler
- `hermes-context-usage.tsx` — context consumption display (token count, bar, compaction/truncation)
- `builder-shell.tsx` — edit & resend buttons on user messages, auto-checkpoint on submit
- `use-builder-ui-store.ts` — checkpoint state management
- `lib/chat/file-snapshot.ts` — server actions for git operations

## Pitfalls

- **Auto-checkpoint timing**: The checkpoint is created BEFORE `chat.sendMessage`. This captures the project state before Hermes makes changes. If created after sending, the Hermes changes would be included in the snapshot.
- **Git must be available**: `createFileSnapshot` returns null if git is not installed or the workspace is not a git repo. The checkpoint is still saved (with `commitHash: null`) — file rollback just won't work.
- **Existing uncommitted changes**: `revertToFileSnapshot` uses `git reset --hard` which discards ALL uncommitted changes. Ensure no important uncommitted work exists in the generated project workspace when restoring.
- **Import builder-shell as client component**: `createFileSnapshot` and `revertToFileSnapshot` are server actions. They can be called from client components but must be awaited.
- **Message ID matching**: When restoring, the checkpoint's `messageIds` are used to filter `chat.messages`. If message IDs don't match (e.g., after a page reload), the restored conversation may be incomplete. Checkpoints are session-scoped and don't survive page reloads.
- **New session clears everything**: The "New session" button removes ALL checkpoints and clears the chat. There is no undo. If the user wants to save the session state, they should note it before clicking.
