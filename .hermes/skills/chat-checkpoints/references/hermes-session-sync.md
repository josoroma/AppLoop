# Hermes Session Sync (Removed)

## What was attempted

The chat-checkpoints system tried to sync UI sessions with Hermes gateway sessions by sending `/new --yes "apploop:projectId:session-N"` and `/resume "apploop:projectId:checkpointId"` commands through the chat transport.

## Why it failed

1. **Project access denied**: The `/new` command was sent as a regular chat message. Hermes processed it but the session context didn't match, resulting in "Project access denied" errors on subsequent real messages.

2. **Chat route conflicts**: `/api/chat` already handles Hermes session creation automatically via `sessionId: resolveHermesSessionId(project.hermesSessionId)`. Sending explicit `/new` commands conflicted with this flow.

3. **Timing issues**: The session command sent after `setSessionKey` fires on the new chat instance, but the instance may not be ready or the command may process before the session boundary is properly set.

## What works instead

The chat route's built-in session management:
- `hermesSessionId` starts as `reserved:projectId`
- First message → `sessionId: null` (reserved prefix stripped)
- Hermes auto-creates session, returns real ID via `session` event
- Route updates `hermesSessionId` for subsequent messages

UI session isolation uses `chat.setMessages([])` for new sessions and `chat.setMessages(snapshots)` for restore. No gateway commands needed.

## Files

- `app/api/chat/route.ts` — `resolveHermesSessionId`, `session` event handler
- `lib/projects/service.ts` — `reserveHermesSessionId`
