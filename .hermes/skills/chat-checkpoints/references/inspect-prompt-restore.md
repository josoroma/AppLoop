# Inspect → prompt → restore/edit (AppLoop builder)

Canonical product doc: `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`

## Compose + send

1. Inspect enabled → iframe `inspector-provider` selection
2. `preferredSelector` = **last classname** (e.g. `.vestaboard-title`)
3. On Send:
   - `createFileSnapshot(projectId)` → workspace git checkpoint
   - client `saveCheckpoint` with message ids **before** the new prompt
   - `createVisualSelectionPrompt(shortText, selections)` → boundaries + `Target selections JSON`
   - `chat.sendMessage` → `POST /api/chat` (`useChat` id **=** projectId)

## Gateway

`streamProjectRun` with agent bundle:

- workspace under `templates/` → `mode: "template-edit"`
- else → `mode: "project-edit"`

Success surfaces: Hermes chat bubble + activity cards + preview HMR/`?_t=` reload. Files on disk are the durable product change.

## Restore vs Edit

Shared path on a past **user** message:

1. `findCheckpointBeforeMessage` matches messageIds **before** the clicked prompt (never look up by clicked id)
2. `revertToFileSnapshot` if `commitHash`
3. Truncate UI with `messagesBeforeMessage`
4. `deleteProjectConversationMessagesFrom` (durable DB delete from clicked id/time)
5. `restartRuntimeAction` + bump preview reload key

Edit-only: prefill short prompt from **`raw_user_prompt`**, not by splitting rendered composed text on obsolete markers like `Target classnames`.

## DB on send

- INSERT `messages` (user), `runs` (running)
- INSERT assistant `messages`, UPDATE `runs`
- optional session id updates on `projects` / `conversations`

## Do not

- Append sessionKey to `useChat` id
- UI-only restore without DB message delete
- Use `restartRuntimeAction` for normal post-Hermes CSS refresh (use `?_t=` instead)