# Chat Checkpoints & Git Snapshots

A checkpoint saves the conversation state (messages, inspect-mode targets, screenshots) plus a git commit in the generated project for file-level rollback.

## Architecture

```
           Prompt Submit
                │
                ▼
     createFileSnapshot(projectId)
     ├── git init (if needed)
     ├── git add -A
     ├── git commit -m "checkpoint"
     └── returns commit hash
                │
                ▼
     saveCheckpoint(name, messageIds, hash)
     └── stores in Zustand: targets[], screenshots[], messageIds[], commitHash
                │
                ▼
           chat.sendMessage()
```

## Edit & Resend Flow

When a user clicks "Edit & Resend" on a past prompt:

1. Find the checkpoint whose `messageIds` includes this prompt's ID (that's the pre-prompt checkpoint)
2. `revertToFileSnapshot(projectId, cp.commitHash)` → `git reset --hard <hash>` + `git clean -fd`
3. `chat.setMessages(messages.filter(m => idSet.has(m.id)))` → truncate to checkpoint
4. `loadCheckpoint(cp.id)` → restore targets + screenshots
5. Pre-fill textarea with original prompt text (split at "Target classnames" marker)

## File Snapshot API

Location: `lib/chat/file-snapshot.ts`

```typescript
createFileSnapshot(projectId: string): Promise<string | null>
// Returns short commit hash, or null if git unavailable

revertToFileSnapshot(projectId: string, commitHash: string): Promise<boolean>
// Returns true on success
```

Works in `.apploop/projects/<slug>/` directories. Auto-initializes git repos. Falls back to current HEAD if working tree is clean (nothing to commit).

## Checkpoint Store

Location: `components/builder/use-builder-ui-store.ts`

```typescript
type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];  // IDs of user+assistant messages at checkpoint time
  commitHash: string | null;
};
```

Store `messageIds` (not full message objects) because `BuilderChatMessage = UIMessage<unknown, BuilderChatDataTypes>` requires `parts: TextUIPart[]` which can't be reconstructed from plain data. On restore, filter existing messages by ID set.

## Auto-Checkpoint on Every Prompt

The `onSubmit` handler in `builder-shell.tsx`:

1. Captures current `messageIds` from `chat.messages`
2. `await createFileSnapshot(projectId)` → git commit
3. `saveCheckpoint("Prompt N", messageIds, hash)` → store

The manual "Save checkpoint" button was removed — every prompt auto-creates one.

## New Session

Clears all checkpoints via `removeCheckpoint(cp.id)` for each, calls `chat.setMessages([])`, clears targets and screenshots. If the first checkpoint has a `commitHash`, reverts files to that state.

## Known Issues

- Git operations are synchronous `execSync` with timeouts; large projects may need longer timeouts
- Typing: `chat.setMessages()` accepts `BuilderChatMessage[]` which requires `parts` array; filter existing messages rather than constructing new ones
