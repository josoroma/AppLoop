# Session Switching: Save-Before-Restore Pattern

## Problem

When switching between chat sessions (managed conversation branches), the current session's unsaved messages are lost. The target session's message snapshot replaces the current chat, discarding any messages added since the last session boundary.

## Solution

Before loading the target session's messages, save the current chat's messages to the current session's checkpoint via `updateCheckpointMessages`. Only then load the target session.

## Implementation

In `builder-shell.tsx`, `onRestoreCheckpoint`:

```typescript
onRestoreCheckpoint={(cp) => {
  const sessions = checkpoints.filter((c) => c.isSessionBoundary);
  const currentSession = sessions[sessions.length - 1];

  if (currentSession && currentSession.id !== cp.id) {
    const currentMsgs = chat.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ id: m.id, role: m.role, content: getMessageText(m) }));

    store.updateCheckpointMessages(currentSession.id, currentMsgs);
  }

  chat.setMessages(cp.messages.map(m => ({
    id: m.id, role: m.role,
    parts: [{ type: "text", text: m.content }],
  })));

  loadCheckpoint(cp.id);
}}
```

## Store

```typescript
updateCheckpointMessages: (id, messages) =>
  set((state) => ({
    checkpoints: state.checkpoints.map((cp) =>
      cp.id === id ? { ...cp, messages, messageIds: messages.map(m => m.id) } : cp
    ),
  })),
```

## Key Rules

- **Save before switch**: Always capture current messages before loading a different session
- **Never use compound `useChat` IDs**: `id: projectId` only — compound IDs break API route authorization
- **Message snapshots**: Store full `MessageSnapshot[]` (id, role, content) for reliable restoration
- **Auto-checkpoints differ**: Prompt-level checkpoints store message IDs only (for Edit & Resend); session boundaries store full snapshots