# Inspect → prompt → restore/edit (and where the docs live)

Canonical engineer runbook: `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`.

## Happy path

1. Open `/projects/<projectId>` (project workspace under `.apploop/projects/...` **or** template-edit under `templates/<id>`).
2. Toggle Inspect → iframe `apploop:inspector:set-enabled` with `projectId` + `previewNonce`.
3. Click element → `preferredSelector` is **last classname** (e.g. `.vestaboard-title`) → Targets chips.
4. Prompt e.g. `replace by: Josoroma` → Send:
   - `createFileSnapshot` (git commit in workspace)
   - client `saveCheckpoint` (messageIds **before** the new send)
   - `createVisualSelectionPrompt` appends exact selector boundaries + Target selections JSON
   - `useChat` → `POST /api/chat` (`id` = projectId)
5. Success UI: user bubble + streamed Hermes assistant text + activity cards + preview HMR/`?_t=` reload.

## `/api/chat` durable writes

- INSERT `messages` (user) with raw/composed/visualSelectionJson
- INSERT `runs` (running) → UPDATE terminal + hermesRunId
- INSERT `messages` (assistant) with activity metadata
- Optional UPDATE project/conversation `hermes_session_id`
- Agent bundle mode: `template-edit` if workspace under `templates/`, else `project-edit`

## Restore vs Edit (per user message)

Shared:

1. `findCheckpointBeforeMessage` — match checkpoint whose `messageIds` equal user+assistant ids **before** clicked message (never look for clicked id inside checkpoint)
2. `revertToFileSnapshot` if `commitHash`
3. UI `setMessages(messagesBeforeMessage(...))` — drop clicked prompt and everything after
4. `deleteProjectConversationMessagesFrom(projectId, message.id)` — durable truncate
5. `restartRuntimeAction` + bump preview reload key

Edit only: prefill textarea from **raw** short prompt when possible (`raw_user_prompt`). Prefer that over splitting composed text on a marker; current marker is `Target selections JSON:` not only older `Target classnames`.

## Related skills

- Full checkpoint/git details: `chat-checkpoints`
- Selector composition: `visual-selector`
- Template-edit path binding: this skill + custom-template-authoring docs