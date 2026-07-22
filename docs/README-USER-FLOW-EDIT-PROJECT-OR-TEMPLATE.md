# User Flow: Edit Project or Template (Inspect → Prompt → Hermes)

This is the interactive builder path for targeted UI edits — the same shell whether the open workspace is a normal generated project or a **template-edit project** (`workspacePath` under `templates/<id>`, project name usually `Template: …`).

Example project URL used in this walkthrough:

`http://localhost:3001/projects/fb5496a4-daf1-4699-9775-60c229eb29cc`

For a Vestaboard workspace, the inspect target in this guide is `.vestaboard-title`.

---

## Table of contents

1. [Open the builder](#1-open-the-builder)
2. [Enable Inspect Elements](#2-enable-inspect-elements)
3. [Select `.vestaboard-title`](#3-select-vestaboard-title)
4. [Compose and send the prompt](#4-compose-and-send-the-prompt)
5. [What happens while you wait](#5-what-happens-while-you-wait)
6. [Where the response is displayed](#6-where-the-response-is-displayed)
7. [Restore and Edit sub-flows](#7-restore-and-edit-sub-flows)
8. [Actions and APIs used](#8-actions-and-apis-used)
9. [Database tables touched](#9-database-tables-touched)
10. [Main files that implement this flow](#10-main-files-that-implement-this-flow)
11. [Project edit vs template edit](#11-project-edit-vs-template-edit)
12. [Mental model](#12-mental-model)
13. [Failure modes](#13-failure-modes)
14. [Quick checklist](#14-quick-checklist)

---

## 1. Open the builder

1. Ensure the builder is running on **`http://localhost:3001`**.
2. Visit:

   `http://localhost:3001/projects/fb5496a4-daf1-4699-9775-60c229eb29cc`

3. You land in `BuilderShell` for that `projectId`:
   - left panel: conversation + prompt composer
   - right panel: live preview iframe (allocated runtime port)
   - top chrome: Inspect, runtime controls, settings, theme, etc.

`useChat({ id: projectId, … })` ties the AI SDK chat transport to this project. Transport target is **`POST /api/chat`**.

If the project is a template-edit binding, further Hermes runs use `mode: "template-edit"`; otherwise `mode: "project-edit"`. The click path in the UI is the same.

---

## 2. Enable Inspect Elements

1. In the builder chrome, click the **Inspect elements** button (crosshair / inspect icon).
2. `useBuilderUiStore.toggleInspector()` flips `inspectorEnabled`.
3. `PreviewFrame` posts into the iframe:

```ts
{
  type: "apploop:inspector:set-enabled",
  enabled: true,
  projectId,
  previewNonce,
}
```

4. Inside the generated app, `components/inspector-provider.tsx` receives that message, enables hover/click capture, and may disable native interactive pointers while inspecting.

You are now in inspect mode. Hovering paints hover overlays in the parent builder; clicking toggles selection.

---

## 3. Select `.vestaboard-title`

1. In the preview, click the Vestaboard title element whose unique last classname is `vestaboard-title`.
2. Inspector builds a selection payload (`createSelectionPayload`):
   - `classNames` on the element
   - **`preferredSelector`** = last classname, e.g. `.vestaboard-title`
   - optional `inspectorId` / `data-builder-id`
   - ancestry, bounding rect, text preview, route, nonce, projectId
3. Iframe posts:

```ts
{
  type: "apploop:inspector-select",
  projectId,
  previewNonce,
  selection: { preferredSelector: ".vestaboard-title", ... }
}
```

4. Parent `PreviewFrame` validates origin/nonce, parses via `visualSelectionSchema`, then `toggleSelectedElement(selection)`.
5. BuilderUI shows the selection in the composer **Targets** list:

- Label derived from classnames
- Selector shown as `.vestaboard-title` (preferred / class selector)

Multi-select is supported (map keyed by `preferredSelector`). Screenshots are optional and **not** auto-captured on select.

---

## 4. Compose and send the prompt

1. In the prompt textarea, type:

```text
replace by: Josoroma
```

2. Confirm Targets still lists `.vestaboard-title`.
3. Click **Send prompt**.

### What the client composes

`createVisualSelectionPrompt(prompt, selectedElements)` expands the short user text into a **composed prompt**, roughly:

```text
replace by: Josoroma

Modify only elements that match these exact selectors or are strictly descendants of:

- … → .vestaboard-title

Do not modify elements outside these selector boundaries…

Target selections JSON:
{ … full VisualSelection[] … }
```

That composed string is what Hermes receives as the user message text.

Immediately before send, the client also:

1. **`createFileSnapshot(projectId)`** — git commit (`checkpoint`) in the workspace; returns short hash.
2. **`saveCheckpoint(...)`** — UI checkpoint storing prior message ids + commit hash (used later by Restore/Edit).
3. **`chat.sendMessage({ text: composed, files? })`** — AI SDK stream to `/api/chat`.
4. Clears the textarea, selected targets, and attached screenshots.

Composer enters busy state (`chat.status` = `submitted` | `streaming`): send disabled, stop enabled.

---

## 5. What happens while you wait

### A. Browser → AppLoop API

`DefaultChatTransport` POSTs JSON to **`/api/chat`**:

```json
{
  "id": "fb5496a4-daf1-4699-9775-60c229eb29cc",
  "messages": [ /* prior UI messages + new user message */ ]
}
```

### B. `/api/chat` authorization + bookkeeping

In `app/api/chat/route.ts`:

1. `requireProjectAccess` loads project overview (project, conversation, theme, settings, runtime).
2. Extracts last user message text + optional image attachments.
3. `extractPromptMetadata` splits raw vs composed prompt and visual selection JSON.
4. Resolves Hermes session id (`resolveRunHermesSessionId`).
5. Detects template workspace via `getTemplateIdFromWorkspacePath(workspacePath)`:
   - under `templates/` → **template-edit** agent mode
   - under projects root → **project-edit**
6. **INSERT** user `messages` row.
7. **INSERT** `runs` row (`status=running`).
8. Remembers active Hermes run in-memory for cancel.

### C. Hermes gateway stream

Server opens UI message stream and iterates:

```ts
getHermesClient().streamProjectRun({
  projectId,
  conversationId,
  message: composedPrompt,
  workspacePath: project.workspacePath,
  sessionId: hermesSessionId,
  agentBundle: createProjectAgentBundle({ mode: "template-edit" | "project-edit", ... }),
  images?,
})
```

Gateway side (high level):

1. Accept run with AppLoop agent bundle (orchestrator + UI architect + implementer + validation/repair + security as configured).
2. Bind tools to **only** the project/template workspace path.
3. Read the target boundary (`.vestaboard-title` and descendants) from the composed prompt / JSON.
4. Edit files (for Vestaboard: typically `app/page.tsx` title text `Vestaboard` → `Josoroma`, classnames preserved).
5. Optionally validate / repair.
6. Stream events back: session, run id, activity cards (file-change/command), text deltas, Done/Error.

AppLoop maps stream events to AI SDK UI chunks (`text-delta`, `data-hermes-activity`, finish metadata).

### D. Persist assistant result

On completion:

1. **INSERT** assistant `messages` row (`content` = full assistant text, activity metadata JSON).
2. **UPDATE** `runs` → `succeeded` | `failed` | `cancelled` with timestamps + `hermesRunId`.
3. May **UPDATE** `projects.hermes_session_id` / `conversations.hermes_session_id` if the gateway emitted a session event.

Meanwhile the workspace files on disk already reflect Hermes tool writes. Preview reload is nudged after streaming ends via builder reload key / polling CSS watchers depending on status transitions.

---

## 6. Where the response is displayed

On success, the user sees the outcome in **four complementary places**:

| Surface | What you see |
| --- | --- |
| **Chat transcript (left panel)** | New **You** bubble with of composed prompt (JSON collapsed under “Target selections JSON”), then **Hermes** bubble with streamed assistant prose |
| **Hermes activity cards** | Under the assistant message: file-change / command / validation style activity chips from `data-hermes-activity` |
| **Preview iframe (right panel)** | Visual result after files change — title text becomes **Josoroma** once HMR/reload picks up the edit |
| **Busy/error chrome** | Spinner on send while streaming; destructive banner if Hermes offline/errors; Stop aborts stream + `/api/chat/cancel` |

There is no separate success toast required for a normal completion; the assistant message + preview mutation *are* the success UX.

---

## 7. Restore and Edit sub-flows

Each **user** message in the chat shows two actions after send:

| Button | Intent |
| --- | --- |
| **Restore** | Roll project files + conversation back to the state **before** that prompt (drop the prompt and everything after) |
| **Edit** | Same rollback as Restore, then re-populate the composer with the original short prompt text so you can revise and resend |

Both open a confirmation dialog (`Restore project state` vs `Restore and edit`) and share `doConfirmAction()`.

### Shared restore algorithm

```text
clicked user message M
  │
  ├─ findCheckpointBeforeMessage(checkpoints, messages, M)
  │     match checkpoint whose messageIds == all user/assistant ids BEFORE M
  │
  ├─ if checkpoint.commitHash:
  │     revertToFileSnapshot(projectId, commitHash)   // git restore workspace
  │
  ├─ chat.setMessages(messagesBeforeMessage(messages, M))
  │     UI transcript drops M and all later turns
  │
  ├─ loadCheckpoint(cp.id)                            // when checkpoint found
  │
  ├─ if action == edit:
  │     textarea.value = text of M before "Target classnames"/"..." split
  │     (implementation splits on "Target classnames" marker edge)
  │     focus textarea
  │
  ├─ deleteProjectConversationMessagesFrom(projectId, M.id)
  │     durable DB delete of M and later conversation messages
  │
  ├─ restartRuntimeAction(projectId)                  // bounce preview process
  └─ bump previewReloadKey                            // force iframe cache-bust reload
```

### Restore vs Edit differences

| Step | Restore | Edit |
| --- | --- | --- |
| Git snapshot revert | yes (if hash) | yes (if hash) |
| Truncate UI messages | yes | yes |
| Truncate DB messages | yes | yes |
| Restart runtime + reload preview | yes | yes |
| Prefill composer with short prompt | no | yes |
| Auto-resend | no | no — user edits text and clicks Send again |

### Why checkpoints matter

On send, AppLoop snapshots **file state before the prompt**. Restore uses that hash so the Vestaboard title (or any other file edits from that turn and later) can be rolled back even if the chat alone would only remove transcript lines.

If no matching checkpoint exists, Restore/Edit still truncate chat UI/DB and restart runtime, but cannot git-revert files precisely.

### Session history restore (related)

`SessionHistory` can also restore from session-boundary checkpoints (full message snapshots). That is a sibling path to per-prompt Restore/Edit, still using `revertToFileSnapshot` when a commit hash is present.

---

## 8. Actions and APIs used

### Browser-local / client

| Call | Role |
| --- | --- |
| `toggleInspector()` / builder UI store | Inspect mode flag + selected targets |
| `postMessage` parent ↔ iframe | Enable inspect, hover, select, route updates |
| `createVisualSelectionPrompt` | Compose bounded edit prompt |
| `createFileSnapshot` (server action) | Pre-prompt git checkpoint |
| `chat.sendMessage` / `useChat` | Stream transport to `/api/chat` |
| `chat.stop` + `POST /api/chat/cancel` | Abort in-flight Hermes run |
| `deleteProjectConversationMessagesFrom` | Durable chat truncation on restore/edit |
| `revertToFileSnapshot` | Git restore workspace |
| `restartRuntimeAction` | Restart preview after restore/edit |

### HTTP APIs

| Endpoint | Method | Role |
| --- | --- | --- |
| `/api/chat` | `POST` | Main Hermes edit stream (project/template mode) |
| `/api/chat/cancel` | `POST` | Cancel active Hermes run for `projectId` |
| `/api/projects/[projectId]/runtime/logs` | `GET` (as used by shell) | Runtime log polling for preview state |
| Reply preview screenshot endpoints | as configured | Optional inspector/clipboard image attach path |

### Hermes gateway (from `/api/chat`)

| Client method | Meaning |
| --- | --- |
| `getHermesClient().streamProjectRun(...)` | Long-lived gateway run with agent bundle + workspace |
| Internal HTTP run start + event stream | Session/run/activity/text/done events |

### Sequence diagram (inspect → send)

```text
User                BuilderShell / UI store          Preview iframe                 POST /api/chat                 Hermes gateway              Workspace FS / SQLite
 |                          |                              |                              |                              |                           |
 |-- click Inspect -------->|                              |                              |                              |                           |
 |                          |-- set-enabled -------------->|                              |                              |                           |
 |-- click .vestaboard-...->|                              |                              |                              |                           |
 |                          |<- inspector-select ----------|                              |                              |                           |
 |-- type + Send ---------->|                              |                              |                              |                           |
 |                          |-- createFileSnapshot ---------------------------------------------------------------> git commit                 |
 |                          |-- saveCheckpoint (client)    |                              |                              |                           |
 |                          |-- sendMessage -------------->|-- POST /api/chat ----------->|                              |                           |
 |                          |                              |                              |-- INSERT message/run ------->|                           |
 |                          |                              |                              |-- streamProjectRun --------->|                           |
 |                          |                              |                              |                              |-- edit page.tsx ---------->|
 |                          |<- text-delta/activity -------|<- stream UI chunks ----------|<- events --------------------|                           |
 |                          |                              |                              |-- INSERT assistant/UPDATE run |                           |
 |-- see Hermes bubble + preview title Josoroma            |                              |                              |                           |
```

---

## 9. Database tables touched

Schema: `lib/db/schema.ts`. Conversation writes go through `lib/projects/repository.ts`.

### On Send prompt (happy path)

| Table | Access | Why |
| --- | --- | --- |
| `projects` | **QUERY** | Access check, workspacePath, themeId, hermesSessionId |
| `conversations` | **QUERY** | Active conversation for the project |
| `project_themes` / `project_settings` / `runtimes` | **QUERY** | Bundle theme/settings into agent context; runtime not required for chat but loaded in overview |
| `messages` | **INSERT** | User message (raw + composed + `visualSelectionJson` + screenshot ids + hermes session) |
| `runs` | **INSERT** then **UPDATE** | AppLoop run lifecycle; stores `hermes_run_id`, status, timestamps |
| `messages` | **INSERT** | Assistant message + activity metadata JSON |
| `projects` | **UPDATE** (optional) | Hermes session id if gateway emits new session |
| `conversations` | **UPDATE** (optional) | Hermes session id mirror |

Checkpoints created immediately before send today primarily live in the **client UI store** (and multiple session reloads may hydrate related persistence depending on chat-checkpoints components). File truth is the **git commit** in the workspace. Server-side `chat_checkpoints` rows may also be written by session/checkpoint flows when those components persist — Treat git snapshot + conversation messages as the durable restore anchors for this path.

**Not** required for a plain inspect+send:

- `project_templates` (except template is already bound via workspace path)
- `screenshots` table — only when capturing/uploading screenshots through screenshot APIs
- `project_snapshots` recovery zip path (separate recovery subsystem)

### On Restore / Edit

| Table | Access | Why |
| --- | --- | --- |
| `projects` / `conversations` | **QUERY** | Auth + active conversation |
| `messages` | **DELETE from messageId onward** | `deleteConversationMessagesFrom` — removes clicked user prompt and all later rows (including later assistant orphans) |
| `runtimes` | **UPDATE** (via restart action) | Preview process restart metadata (pid/status/ports as runtime service updates) |

Git operations are on disk (`.git` under workspace), not via `git_commits` table unless a separate tracker records them.

### Message content shape of interest

User row fields commonly populated on inspect prompts:

- `content` / `composed_prompt` — includes target boundaries + JSON
- `raw_user_prompt` — short human text when extractable
- `visual_selection_json` — structured selection payload
- `screenshot_ids_json` — if images attached
- `hermes_session_id` — session correlation

---

## 10. Main files that implement this flow

### Builder UI

| File | Role |
| --- | --- |
| `app/projects/[projectId]/page.tsx` | Loads overview/messages; mounts `BuilderShell` |
| `components/builder/builder-shell.tsx` | Chat UI, inspect button, composer, send, restore/edit confirm, busy/stop |
| `components/builder/preview-frame.tsx` | iframe, nonce, postMessage bridge, selection overlays |
| `components/builder/use-builder-ui-store.ts` | Inspector flag, selected elements map, screenshots, client checkpoints |
| `components/builder/chat-checkpoints.tsx` | Checkpoint UI / persistence helpers as used by shell |
| `components/builder/session-history.tsx` | Session-boundary restore sibling flow |
| `components/builder/hermes-context-usage.tsx` | Context usage indicator in chat header |
| `components/builder/json-highlight.tsx` | Renders collapsed target selection JSON |

### Visual selection contract

| File | Role |
| --- | --- |
| `lib/visual-selector/types.ts` | Zod schemas, preferred selector helpers, `createVisualSelectionPrompt` |
| `templates/*/components/inspector-provider.tsx` | In-preview inspect (Vestaboard: `templates/vestaboard/...`) |
| `tests/visual-selector.test.ts` | Prompt composition / selector contract tests |

### Chat + checkpoints + files

| File | Role |
| --- | --- |
| `app/api/chat/route.ts` | Auth, persist user/run, stream Hermes, persist assistant |
| `app/api/chat/cancel/route.ts` | Cancel active run |
| `lib/chat/messages.ts` | Message text/metadata helpers |
| `lib/chat/prompt-metadata.ts` | Split raw/composed/visual JSON from prompt |
| `lib/chat/run-store.ts` | In-memory active Hermes run map for cancel |
| `lib/chat/checkpoint-restore.ts` | `findCheckpointBeforeMessage` / `messagesBeforeMessage` |
| `lib/chat/file-snapshot.ts` | `createFileSnapshot` / `revertToFileSnapshot` |
| `lib/chat/message-actions.ts` | Server actions for DB message deletion |
| `tests/checkpoint-restore.test.ts` | Restore ordering tests |

### Hermes + agent mode

| File | Role |
| --- | --- |
| `lib/hermes/client.ts` | `streamProjectRun` gateway client |
| `lib/hermes/agents.ts` | `createProjectAgentBundle` (`project-edit` / `template-edit`) |
| `lib/hermes/session-sync.ts` | Session id resolution for runs |
| `lib/projects/template-authoring.ts` | `getTemplateIdFromWorkspacePath` mode detection |
| `.hermes/agents/*`, `.hermes/bundles/ui-builder/*`, skills/hooks/commands | Authoritative agent assets |

### Runtime / security

| File | Role |
| --- | --- |
| `lib/runtime/actions.ts` | `restartRuntimeAction` after restore/edit |
| `lib/security/authorization.ts` | `requireProjectAccess` for chat/message actions |
| `lib/security/paths.ts` | Screenshot dirs / workspace containment |
| `lib/preview/browser.ts` | Nonce, origin trust, frame src builders |

### Persistence

| File | Role |
| --- | --- |
| `lib/db/schema.ts` | `messages`, `runs`, `conversations`, `projects`, … |
| `lib/projects/repository.ts` | create/update/delete messages & runs, session updates |
| `lib/db/repository.ts` | Repository interface |

### Compound diagram

```text
BuilderShell
  ├─ useChat ──────────────────────────► POST /api/chat
  │                                         ├─ requireProjectAccess
  │                                         ├─ messages INSERT (user)
  │                                         ├─ runs INSERT
  │                                         ├─ hermes.streamProjectRun
  │                                         │     └─ agentBundle mode:
  │                                         │          project-edit | template-edit
  │                                         ├─ stream UI deltas
  │                                         ├─ messages INSERT (assistant)
  │                                         └─ runs UPDATE
  │
  ├─ Inspect button → UI store → PreviewFrame postMessage
  │                                   └─ iframe inspector-provider
  │                                         └─ preferredSelector (.vestaboard-title)
  │
  ├─ send form
  │    ├─ createVisualSelectionPrompt
  │    ├─ createFileSnapshot (git)
  │    └─ saveCheckpoint (client)
  │
  └─ Restore / Edit
       ├─ findCheckpointBeforeMessage
       ├─ revertToFileSnapshot
       ├─ setMessages(before)
       ├─ deleteProjectConversationMessagesFrom
       └─ restartRuntimeAction + reloadKey
```

---

## 11. Project edit vs template edit

| Concern | Project edit | Template edit |
| --- | --- | --- |
| How you opened it | Create Project / Open project | Create Template success redirect, or Templates → Edit |
| Workspace path | under `PROJECTS_ROOT` (e.g. `.apploop/projects/<slug>`) | under `templates/<templateId>` |
| Agent bundle mode | `project-edit` | `template-edit` |
| Guardrails emphasis | edit this generated app only | preserve template identity / classname stamps / provider compatibility |
| Inspect UX | identical | identical |
| Restore/Edit UX | identical | identical |
| Success response display | chat + preview | chat + preview |

The walkthrough with Vestaboard + `.vestaboard-title` applies to **either**, so long as the open project workspace is that Vestaboard tree.

---

## 12. Mental model

```text
Inspect  → preferredSelector last classname
Prompt   → short human text + composed selector boundaries
Send     → git checkpoint + /api/chat stream
Gateway  → agent bundle edits workspace files
UI       → streamed Hermes message + activity cards
Preview  → shows live DOM/CSS after reload/HMR
Restore  → git + truncate chat from clicked prompt
Edit     → Restore + prefill short prompt for resend
```

Hermes never "returns" only chat text for UI edits — the durable product change is **files on disk** (and DB transcript). Preview is a view of those files via the runtime.

---

## 13. Failure modes

- Preview not running → inspect still depends on iframe; start runtime first if the frame is blank.
- Inspect click on non-classed node → provider walks up to nearest inspectable classname element.
- Wrong multi-select collision → two elements sharing the same last classname cannot be distinguished; templates should keep unique last classnames.
- Hermes offline → chat error banner; run marked failed; user prompt already stored.
- Cancel mid-stream → `/api/chat/cancel` + UI stop; partial assistant text may be absent; run cancelled.
- Restore without checkpoint hash → transcript rollback only; files may remain at later state.
- Restore with hash → files rewind; still need runtime restart so preview does not serve stale bundles.
- Timestamp / orphan assistant rows → delete-from-id path is designed to remove later conversation rows including orphans associated after the clicked prompt.

---

## 14. Quick checklist

- [ ] Open `http://localhost:3001/projects/fb5496a4-daf1-4699-9775-60c229eb29cc`
- [ ] Ensure preview runtime is running
- [ ] Click **Inspect elements**
- [ ] Click title → Targets shows `.vestaboard-title`
- [ ] Prompt: `replace by: Josoroma`
- [ ] Send → wait for streaming Hermes message + activity
- [ ] Confirm preview title is **Josoroma**
- [ ] Optional: **Restore** on that user bubble → title (and transcript) rewind
- [ ] Optional: **Edit** → composer prefilled → revise → send again
