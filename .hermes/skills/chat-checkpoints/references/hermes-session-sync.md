# Hermes Session Sync

When the user creates a "New session" in AppLoop, the UI session must be synced with Hermes's session mechanism. Hermes maintains its own conversation context, identified by a `sessionId`. Creating a new UI session should also start a fresh Hermes conversation.

## Mechanism

1. User clicks "New session" → `sessionKey` increments → new `useChat` instance with fresh `id`
2. A `/new --yes Session N` command is queued in `sessionCommandRef`
3. A `useEffect` watching `sessionKey` sends the queued command via `chat.sendMessage({ text: cmd })`
4. Hermes processes `/new --yes Session N`, creates a new Hermes session, and returns the new `sessionId` via a `session` event in the streaming response
5. The chat route (`app/api/chat/route.ts`) catches the `session` event and calls `repository.updateProjectHermesSession(projectId, event.sessionId)`

## Code Pattern

```typescript
// In builder-shell.tsx:

const [sessionKey, setSessionKey] = useState(0);
const sessionCommandRef = useRef<string | null>(null);

// Send /new command when session changes
useEffect(() => {
  if (sessionCommandRef.current) {
    const cmd = sessionCommandRef.current;
    sessionCommandRef.current = null;
    void chat.sendMessage({ text: cmd });
  }
}, [sessionKey]);

// In the "New session" handler:
setSessionKey((k) => k + 1);
sessionCommandRef.current = `/new --yes Session ${sessionNum}`;
```

## Session ID Flow

```
Project creation → reserveHermesSessionId(projectId) → "reserved:{projectId}"
First chat message → sessionId: null (reserved prefix stripped by resolveHermesSessionId)
Hermes responds → session event with real sessionId
Route handler → updateProjectHermesSession(projectId, realSessionId)
Subsequent messages → sessionId: realSessionId (maintains context)

"New session" → /new --yes Session N → new Hermes sessionId returned → same flow
```
