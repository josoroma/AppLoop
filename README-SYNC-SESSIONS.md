# AppLoop Session, Checkpoint, Prompt, Restore, and Hermes Synchronization Review

This document explains the current AppLoop chat/session architecture and proposes a concrete design for keeping AppLoop UI sessions, SQLite conversations, gateway runs, Hermes session IDs, persisted message history, checkpoints, restores, branches, and resumed conversations synchronized with real Hermes agent sessions.

Scope: this is an analysis-only document. It does not modify application code.

## Executive summary

AppLoop currently has two overlapping concepts of “session”:

1. **AppLoop UI session boundaries** stored as `chat_checkpoints` rows with `isSessionBoundary: true` and full message snapshots.
2. **Hermes agent sessions** stored by the Hermes gateway/agent in `.hermes/state.db`, identified by `session_id` / `sessionId`, and resumed by passing that ID to `/v1/runs/stream` or `/v1/runs`.

The current implementation clears or restores `useChat` client state and restores generated project files from git snapshots, but it generally **does not create, fork, rewind, or switch the real Hermes agent session**. As a result, a restored or “new” AppLoop session can still send its next prompt into the old Hermes session, whose internal message history may contain prompts and tool results that AppLoop has hidden or deleted from its own database.

The recommended fix is to make **AppLoop conversations the durable branch/session unit** and bind each AppLoop conversation to exactly one real Hermes session. New session, restore, edit-and-resend, branch, and resume should update a single active `conversationId` and a single active `hermesSessionId` together, inside an explicit transaction, before the next run is sent to Hermes.

---

## Current architecture map

### Main files

| Area | Current file(s) | Responsibility |
|---|---|---|
| Builder page hydration | `app/projects/[projectId]/page.tsx` | Loads project overview, runtime logs, and up to 50 persisted messages from the active project conversation. |
| Chat UI and submit/restore/session controls | `components/builder/builder-shell.tsx` | Owns `useChat`, prompt form, checkpoint creation, new session, restore, edit, runtime reload/restart. |
| Client UI store | `components/builder/use-builder-ui-store.ts` | Zustand store for selected inspect elements, screenshots, and checkpoints. |
| Checkpoint actions | `lib/chat/checkpoint-actions.ts` | Server actions for listing/saving/deleting `chat_checkpoints`. |
| File snapshots | `lib/chat/file-snapshot.ts` | Git commit before prompts and `git reset --hard` on restore. |
| Restore helpers | `lib/chat/checkpoint-restore.ts` | Finds the prompt checkpoint that precedes a user message and computes truncation. |
| AppLoop DB schema | `lib/db/schema.ts` | `projects`, `conversations`, `messages`, `runs`, `chat_checkpoints`, screenshots, runtime state, etc. |
| AppLoop repository | `lib/projects/repository.ts` | CRUD for projects/conversations/messages/runs/checkpoints and Hermes session IDs. |
| Chat API | `app/api/chat/route.ts` | Persists user messages, creates AppLoop run rows, sends payload to Hermes, streams response, persists assistant messages. |
| Hermes client | `lib/hermes/client.ts` | Sends REST/WebSocket payloads to the gateway/API server and normalizes streams. |
| Agent bundle metadata | `lib/hermes/agents.ts`, `lib/hermes/skills.ts`, `lib/hermes/commands.ts`, `lib/hermes/hooks.ts` | Builds the AppLoop project-agent bundle included with every Hermes run. |
| Visual selector types | `lib/visual-selector/types.ts` | Validates and serializes inspect-mode selections and target prompt blocks. |
| Preview iframe bridge | `components/builder/preview-frame.tsx`, `templates/*/components/inspector-provider.tsx` | Cross-origin postMessage protocol for route sync, hover/select payloads, and overlay geometry. |

### Current persistent stores

#### AppLoop database: `.apploop/builder.sqlite`

Relevant tables from `lib/db/schema.ts`:

- `projects`
  - `id`
  - `workspace_path`
  - `hermes_session_id`
  - `preview_port`
  - project status/theme timestamps
- `conversations`
  - `id`
  - `project_id`
  - `hermes_session_id`
  - `title`
- `messages`
  - `id`
  - `conversation_id`
  - `role`
  - `content`
  - `metadata_json`
  - `created_at`
- `runs`
  - `id`
  - `project_id`
  - `conversation_id`
  - `hermes_run_id`
  - `status`
  - timestamps
- `chat_checkpoints`
  - `id`
  - `project_id`
  - `name`
  - `is_session_boundary`
  - `data_json`
  - `created_at`
- `screenshots`
  - uploaded/pasted screenshot metadata

#### Hermes database: `.hermes/state.db`

Relevant tables observed from the local Hermes state DB:

- `sessions`
  - `id`
  - `source`
  - `session_key`
  - `model`
  - `system_prompt`
  - `parent_session_id`
  - `started_at`, `ended_at`
  - message/tool/token/cost counters
  - `cwd`, `git_branch`, `git_repo_root`
  - `rewind_count`, `archived`
- `messages`
  - integer `id`
  - `session_id`
  - `role`
  - `content`
  - `tool_call_id`, `tool_calls`, `tool_name`
  - timestamps/token metadata
  - `active`, `compacted`
- `gateway_routing`
  - routing entries by scope/session key

AppLoop currently only stores the Hermes session ID returned from stream events; it does not directly update Hermes DB messages or active flags.

---

## How a project and initial Hermes session reservation work today

When a project is created in `ProjectService.createProject()`:

1. A new AppLoop `projectId` is generated.
2. A generated project workspace path is allocated under `.apploop/projects/<slug>`.
3. A preview port is allocated.
4. `reserveHermesSessionId(projectId)` returns `reserved:<projectId>`.
5. That reserved value is written to both:
   - `projects.hermesSessionId`
   - `conversations.hermesSessionId`
6. A project, conversation, runtime row, theme row, and settings row are inserted as one project bundle.

Important detail: `reserved:<projectId>` is **not** a real Hermes session. In `/api/chat/route.ts`, `resolveHermesSessionId()` turns any missing or `reserved:` value into `null`. The first real prompt therefore asks Hermes to create a new session. When Hermes emits a `session` event, AppLoop writes the real session ID back to both `projects.hermesSessionId` and `conversations.hermesSessionId`.

---

## Current prompt submission flow

When the user presses Send in `builder-shell.tsx`:

1. The prompt textarea value is read and trimmed.
2. If there are selected visual targets, `createVisualSelectionPrompt(prompt, selectedElements)` appends a target-boundary block and JSON payload to the user prompt.
3. AppLoop computes the current visible message IDs from `chat.messages`.
4. `createFileSnapshot(projectId)` is called.
5. A prompt checkpoint is created in the Zustand store:
   - name: `Prompt ${checkpoints.length + 1}`
   - `messageIds`: visible user/assistant IDs **before** the new prompt exists
   - `commitHash`: returned git hash or `null`
   - `isSessionBoundary: false`
   - current selected targets and screenshots
   - no full message snapshots
6. A store effect observes `checkpoints` and upserts each checkpoint into `chat_checkpoints` using `saveChatCheckpoint()`.
7. `chat.sendMessage({ text: messageText, files })` sends the composed user message and any screenshot file parts through the AI SDK `DefaultChatTransport` to `POST /api/chat`.
8. The form resets, screenshots are cleared, and selected elements are cleared.

On the server in `/api/chat/route.ts`:

1. The route receives `{ id: projectId, messages }` from `useChat`.
2. It reads the last user message with `getLastUserMessage(messages)`.
3. It loads the active project overview through `requireProjectAccess()`.
4. It extracts plain text using `getMessageText(userMessage)`. This is the fully composed prompt after visual target context has been appended.
5. It extracts image file parts using `extractImagesFromMessage()`.
6. It creates an AppLoop `runId` and persists:
   - user message row in `messages`
   - run row in `runs` with `status: running`
7. It calls `getHermesClient().streamProjectRun()` with:
   - `projectId`
   - active AppLoop `conversation.id`
   - `message: prompt`
   - `workspacePath`
   - `sessionId: resolveHermesSessionId(project.hermesSessionId ?? conversation.hermesSessionId)`
   - `agentBundle: createProjectAgentBundle(...)`
   - optional `images`
8. As Hermes events stream back:
   - `session` updates AppLoop `projects.hermesSessionId` and `conversations.hermesSessionId`.
   - `run` updates AppLoop `runs.hermesRunId`.
   - `activity` events are written to the UI stream and accumulated in assistant metadata.
   - `text-delta` events are streamed to the UI and accumulated as assistant text.
9. On completion, the assistant message is persisted with ID `assistant-${runId}` and metadata containing AppLoop run ID, Hermes run ID, and activity events.
10. The run is marked `succeeded` or `failed`.

---

## How checkpoints work today

### Prompt checkpoint

A prompt checkpoint is created immediately before each user prompt is sent.

It captures:

- The selected inspect-mode targets at that moment.
- The attached screenshots at that moment.
- The ordered IDs of visible user/assistant messages that existed before the prompt.
- A git commit hash for the generated project workspace, if `createFileSnapshot()` succeeds.
- `isSessionBoundary: false`.

It does **not** capture:

- The prompt about to be sent.
- The assistant response that will be created later.
- A new AppLoop conversation row.
- A new Hermes session ID.
- A Hermes checkpoint/rewind marker.

### File snapshot details

`createFileSnapshot(projectId)`:

1. Loads the project overview and workspace path.
2. Ensures the workspace has its own `.git` directory, lazily initializing it if needed.
3. Verifies `git rev-parse --show-toplevel` equals the generated project workspace, not the parent AppLoop repo.
4. Runs `git add -A`.
5. Runs `git commit --allow-empty -m "checkpoint"`.
6. Returns the short commit hash, or current `HEAD` if commit creation fails due to a clean tree.
7. Returns `null` if git is unavailable or the workspace is not a safe project-level git repo.

This changes the generated project’s `.git` history but not the AppLoop source repo.

### Checkpoint DB persistence

The Zustand store writes checkpoints to `chat_checkpoints` via a React effect:

```ts
for (const cp of checkpoints) {
  void saveChatCheckpoint(cp.id, projectId, cp.name, cp.isSessionBoundary, JSON.stringify(cp));
}
```

The DB row stores the full serialized checkpoint in `data_json`. The normalized columns only contain project ID, name, boundary flag, and creation time.

---

## What exactly happens when a new AppLoop session is created today

The “New” button in `ChatCheckpoints` calls `onNewSession` in `builder-shell.tsx`.

Current behavior:

1. AppLoop collects all current visible `chat.messages` whose role is `user` or `assistant`.
2. It creates `messageIds` from those messages.
3. It creates full `MessageSnapshot[]` values:
   - `id`
   - `role`
   - `content` from `getMessageText()`
4. It creates a generated-project git snapshot by calling `createFileSnapshot(projectId)`.
5. It creates a checkpoint named `Session N` with:
   - `isSessionBoundary: true`
   - current message IDs
   - current full message snapshots
   - current targets/screenshots
   - current git commit hash
6. It removes all non-session prompt checkpoints from the Zustand store and deletes them from `chat_checkpoints`.
7. It calls `chat.setMessages([])`.
8. It clears selected inspect targets and screenshots.
9. It resets a local `hasInitialSessionRef` flag.

What does **not** happen today:

- No new `conversations` row is created.
- The active project still points at the same existing conversation.
- The existing AppLoop `messages` rows are not deleted or moved.
- `projects.hermesSessionId` and `conversations.hermesSessionId` are not changed to a new `reserved:` ID or new real Hermes session.
- No `/new`, fork, branch, or rewind command is sent to the real Hermes agent.
- The next prompt is still sent with the old real Hermes session ID if one exists.
- On a full page reload, `app/projects/[projectId]/page.tsx` reloads messages from the same conversation, so hidden messages can reappear unless separately deleted.

Therefore, today’s “New” is mostly a **client-side visual reset plus a saved session-boundary checkpoint**, not a real new AppLoop database conversation or Hermes context.

---

## What happens to project state, conversation history, and Hermes context on save/restore

### Project state

Project files are snapshotted and restored using git in the generated workspace:

- Save: `git add -A && git commit --allow-empty -m checkpoint`
- Restore: `git reset --hard <commitHash>`

This covers source files tracked by that workspace’s `.git`. It does not reset:

- `node_modules`
- `.next`
- runtime process state
- AppLoop database rows
- Hermes database rows
- screenshots in AppLoop screenshot storage
- provider/model cache
- external side effects from Hermes tools

After per-prompt restore/edit, AppLoop calls `restartRuntimeAction()` and bumps `previewReloadKey` because file watcher state may not notice `git reset --hard` reliably.

### AppLoop conversation history

Prompt submission persists user and assistant messages to the single active AppLoop conversation row.

Per-prompt Restore/Edit currently:

1. Finds the pre-prompt checkpoint by matching the ordered message IDs **before** the clicked user prompt.
2. Restores files to the checkpoint’s git hash if present.
3. Calls `chat.setMessages(messagesBeforeMessage(chat.messages, message))`.
4. Restores targets/screenshots with `loadCheckpoint(cp.id)`.
5. Deletes persisted DB messages from the clicked user message onward using `deleteConversationMessagesFrom()`.
6. Restarts runtime and reloads preview.
7. Edit only: puts the old prompt back into the textarea.

This handles AppLoop’s visible and persisted message history for per-prompt restore, but only inside the active conversation.

Session restore from the history dropdown currently:

1. Restores files to the session checkpoint commit hash.
2. Saves the current session’s messages into its checkpoint before switching.
3. Reconstructs `chat.messages` from the target checkpoint’s `MessageSnapshot[]`.
4. Restores targets/screenshots from the checkpoint.

It does not update the active AppLoop conversation row, active conversation ID, or real Hermes session ID.

### Hermes context

Hermes context is the model-facing session stored by Hermes itself. It includes:

- System/developer prompt and project context injected at session start.
- User/assistant/tool messages in `.hermes/state.db.messages`.
- Tool results.
- Skill loads.
- Compression state and active/inactive message flags.
- The real `session_id` returned by Hermes.

Currently, AppLoop passes one `sessionId` per run, based primarily on `project.hermesSessionId`. If AppLoop restores or clears its UI without creating/restoring/forking the corresponding Hermes session, the next Hermes run can still see the old model-facing history.

This is the central synchronization problem.

---

## Prompt editing and re-execution today

Each rendered user message has two inline controls: **Restore** and **Edit**.

### Restore

Restore:

1. Locates the checkpoint immediately before that user prompt.
2. Resets generated project files to that checkpoint commit.
3. Truncates in-memory chat before the clicked prompt.
4. Restores targets/screenshots from the checkpoint.
5. Deletes persisted AppLoop messages from the clicked prompt onward.
6. Restarts the runtime and reloads preview.

### Edit

Edit does everything Restore does, then pre-fills the textarea with the original prompt text.

Current prompt extraction uses:

```ts
getMessageText(message).split("Target classnames")[0]?.trim()
```

However, the current visual selector composer appends the marker `Target selections JSON:`, not `Target classnames`. That means editing a targeted prompt may leave the target instructions and JSON in the editable text, depending on the content. A safer design is to persist the user-authored prompt separately from the composed prompt.

### Re-execution gap

After Edit, the next send is treated as a normal prompt submission. It uses the current `projects.hermesSessionId` / `conversations.hermesSessionId`, which may still identify the same real Hermes session that contains the restored-away prompt and tool results. AppLoop’s DB may be truncated, but Hermes is not necessarily truncated.

---

## Inspect Mode: how class names are selected and appended to the prompt

### Iframe-to-parent protocol

`PreviewFrame` embeds the generated app in an iframe. The generated template’s `InspectorProvider` listens for parent messages:

```ts
{
  type: "apploop:inspector:set-enabled",
  enabled,
  projectId,
  previewNonce
}
```

When enabled, `InspectorProvider`:

1. Finds inspectable elements with the selector `[class]`.
2. On pointer move, builds a `SelectionPayload` for the hovered element and posts:
   - `type: "apploop:inspector-hover"`
   - `selection`
3. On pointer down, toggles the selected element in an iframe-local `Map` and posts:
   - `type: "apploop:inspector-select"`
   - `selection`
4. Every 100ms, and on scroll/resize, republishes updated bounding rectangles for selected/hovered elements.
5. Hooks route changes and posts `apploop:preview-route` messages.

The parent validates origin, `projectId`, and `previewNonce` with `isTrustedPreviewMessage()` before accepting selection updates.

### Selection payload shape

`lib/visual-selector/types.ts` validates each selection as:

```ts
{
  projectId: string,
  previewNonce: string,
  route: string,
  tagName: string,
  classNames: string[],
  preferredSelector: string,
  inspectorId?: string,
  componentName?: string,
  sourceFile?: string,
  sourceLine?: number,
  textPreview?: string,
  ancestry: Array<{
    tagName: string,
    classNames: string[],
    inspectorId?: string
  }>,
  boundingRect: {
    x: number,
    y: number,
    width: number,
    height: number
  }
}
```

The template provider currently chooses `preferredSelector` from the **last class name** on the element. This is why the generated-code contract says every user-visible generated UI element should have shared/base classes plus a unique, human-readable class name written last.

### Selector boundaries in the composed prompt

`createVisualSelectionPrompt()` builds the final user text sent to `/api/chat`.

If no selections are active, the prompt is unchanged.

If selections exist, it appends:

1. The original prompt.
2. A boundary instruction:
   - “Modify only elements that match these exact selectors or are strictly descendants of:”
3. One bullet per selection:
   - `- ${classNameLabel} → ${selection.preferredSelector}`
4. A negative boundary instruction:
   - “Do not modify elements outside these selector boundaries, even if they share the same base class names, unless the user explicitly requests a global change.”
5. `Target selections JSON:` followed by pretty-printed `VisualSelection[]`.

The selector boundary is therefore represented twice:

- Human-readable bullets for the model.
- Structured JSON containing route, classes, preferred selector, ancestry, text preview, and bounding rectangle.

### Bounding rectangle semantics

`boundingRect` comes directly from `element.getBoundingClientRect()` in the iframe. It is viewport-relative and can contain negative `x` or `y` for scrolled elements. It is used for overlay rendering and spatial context, not as the primary source-file locator.

### Parent overlay representation

`PreviewFrame` renders `.preview-selection-overlay` elements outside the iframe using CSS variables:

- `--selection-x`
- `--selection-y`
- `--selection-width`
- `--selection-height`

The label displays:

- class label from `getClassNameLabel()`
- selector from `getPreferredSelector()`
- locked state if selected

---

## Screenshots and image attachments

The current code path supports screenshots as chat file attachments, but automatic screenshot-on-click was removed from templates.

### Current screenshot path

1. The user pastes an image into the prompt textarea.
2. `builder-shell.tsx` reads the clipboard image as a data URL for immediate thumbnail display.
3. It adds a temporary `ScreenshotAttachment` to the store.
4. It uploads the file in the background to:
   - `POST /api/projects/:projectId/screenshots`
5. The screenshot route validates media type, size, and magic bytes.
6. The image is stored under the project screenshots directory.
7. A `screenshots` DB row is inserted.
8. On prompt submit, `chat.sendMessage()` includes file parts:

```ts
{
  type: "file",
  mediaType: "image/png",
  filename,
  url: screenshot.serverPath
}
```

9. `/api/chat` calls `extractImagesFromMessage()`:
   - data URLs are converted directly to base64
   - server screenshot URLs are resolved to screenshot DB rows and files on disk
10. Hermes receives `images: [{ mediaType, data }]` in the payload.

### Legacy inspector screenshot type

`InspectorScreenshotMessage` still exists in `lib/visual-selector/types.ts`:

```ts
{
  type: "apploop:inspector-screenshot",
  projectId,
  previewNonce,
  dataUrl,
  selector
}
```

But current templates no longer send it. It should be treated as compatibility surface, not the main screenshot path.

---

## Where the composed Hermes payload is built and sent

### AppLoop route payload

`/api/chat/route.ts` builds a `HermesRunRequest` and calls `HermesClient.streamProjectRun()`.

The request contains:

- `projectId`
- AppLoop `conversationId`
- composed `message`
- generated project `workspacePath`
- current or null `sessionId`
- `agentBundle`
- optional base64 images
- abort signal

### Agent bundle: what skills, agents, bundle, and commands are included

`createProjectAgentBundle()` in `lib/hermes/agents.ts` creates:

- Orchestrator agent:
  - `project-builder` (`.hermes/agents/project-builder.md`)
- Delegate agents:
  - `ui-architect`
  - `nextjs-implementer`
  - `validation-repair`
  - `security-auditor`
- Skill bundle:
  - `/ui-builder` (`.hermes/bundles/ui-builder/BUNDLE.md`)
- Skills in activation order:
  1. `/security-review`
  2. `/hermes-gateway`
  3. `/visual-selector`
  4. `/theme-system`
  5. `/frontend-design`
  6. `/generated-app-standards`
  7. `/project-runtime`
- Hooks:
  - `project-scope-guard`
  - `generated-code-review`
  - `theme-integrity`
  - `preview-readiness`
- Commands:
  - `/project-build`
  - `/project-fix`
  - `/project-preview`
  - `/project-theme`
  - `/project-element-edit`
  - `/project-validate`
  - `/project-snapshot`
- Layout validation script:
  - `npm run hermes:validate`

For targeted inspect-mode prompts, the most relevant command is `/project-element-edit`; for broad generated-project changes, `/project-build`; for validation-only runs, `/project-validate`; for restoring/snapshot-aware operations, `/project-snapshot`.

### REST streaming payload

For REST transport, `HermesClient.streamRunPayload()` sends `POST /v1/runs/stream` with:

```ts
{
  projectId,
  conversationId,
  message,
  input: message,
  workspacePath,
  sessionId,
  session_id: sessionId,
  gatewayIntegration,
  model,
  agentBundle,
  images?
}
```

If `/v1/runs/stream` returns `404` or `405`, AppLoop falls back to gateway run creation plus event streaming.

### Gateway fallback payload

For gateway fallback, AppLoop sends `POST /v1/runs` with:

```ts
{
  input: message,
  instructions: createGatewayInstructions(request),
  model,
  session_id: sessionId ?? undefined,
  agentBundle,
  metadata: {
    projectId,
    conversationId,
    workspacePath,
    gatewayIntegration,
    inferenceModel,
    inferenceProvider,
    agentBundle
  },
  images?
}
```

Then it reads events from:

```txt
GET /v1/runs/:runId/events
```

### Gateway instructions

`createGatewayInstructions()` restates the AppLoop role and includes:

- Project ID
- Workspace path
- Default route
- Selected theme
- Package install policy
- Validation depth
- Orchestrator and delegate agent paths
- Skill bundle path and activation order
- Hooks
- Commands
- Validation script
- Generated-code classname contract

### Stream normalization

`lib/hermes/events.ts` normalizes Hermes/gateway stream events into:

- `session`
- `run`
- `text-delta`
- `activity`
- `done`
- `error`

AppLoop only updates its stored Hermes session ID when a `session` event appears.

---

## Current synchronization gaps

### Gap 1: New AppLoop session does not create a new AppLoop conversation

Current “New” only clears `useChat` state and creates a session-boundary checkpoint. The database still has one active conversation per project, and page reload rehydrates from that same conversation.

Impact: old messages can reappear; session boundaries are not first-class durable conversations.

### Gap 2: New AppLoop session does not create a new Hermes session

The old real `projects.hermesSessionId` remains in place. The next run resumes the old Hermes context.

Impact: the model can see hidden prior prompts/tool results even though the UI looks empty.

### Gap 3: Restore/Edit truncates AppLoop messages but not Hermes messages

Per-prompt restore deletes AppLoop DB messages from a point onward, but it does not deactivate, rewind, fork, or replace Hermes `.hermes/state.db.messages` for the corresponding real session.

Impact: re-execution can happen with stale model context.

### Gap 4: Session restore uses checkpoint snapshots but not the restored session’s Hermes ID

Session history stores message snapshots and a file commit, but not a dedicated active conversation row and real Hermes session ID per session boundary.

Impact: switching visible sessions does not necessarily switch Hermes context.

### Gap 5: `projects.hermesSessionId` and `conversations.hermesSessionId` can conflict

The chat route resolves session ID from:

```ts
project.hermesSessionId ?? conversation.hermesSessionId
```

If the project-level value is stale, it wins over the conversation-specific value.

Impact: after future multi-conversation support, a restored conversation may still use the wrong project-level Hermes session.

### Gap 6: AppLoop sends only the last prompt as `message`, relying on Hermes session for history

This is correct for an actually synchronized Hermes session, but dangerous when UI/DB history has been edited independently.

Impact: AppLoop cannot repair history divergence by sending its visible message list, because the gateway receives only the new prompt and session ID.

### Gap 7: Checkpoints are project-scoped, not conversation-scoped

`chat_checkpoints` has `project_id` but no `conversation_id` or `hermes_session_id`.

Impact: when multiple sessions/branches exist, prompt checkpoints and session checkpoints can be associated with the wrong visible conversation.

### Gap 8: Run identity mapping is partial

AppLoop stores `runs.hermesRunId`, but there is no stable mapping table between:

- AppLoop run ID
- AppLoop conversation ID
- Hermes run ID
- Hermes session ID at run start
- Hermes session ID at run end
- checkpoint before/after run

Impact: audit, restore, and branch operations cannot reliably identify what Hermes session state a run mutated.

### Gap 9: Prompt editing extracts from rendered composed text

Edit currently attempts to remove target metadata by splitting on `Target classnames`, but current prompt composition uses `Target selections JSON:`.

Impact: edited prompts can accidentally include stale target JSON or boundary instructions. The correct model is to persist both `rawUserPrompt` and `composedPrompt`.

### Gap 10: Session switching saves snapshots asynchronously through client state

The client store updates session checkpoint messages and relies on a React effect to persist them.

Impact: fast navigation, crashes, reloads, or concurrent tabs can lose the last session snapshot.

### Gap 11: Branching and resumed conversations have no explicit model

There is no `parent_conversation_id`, branch point, active conversation pointer, or branch relationship in AppLoop DB.

Impact: restore/edit is destructive truncation rather than creating a durable branch from a prior point.

### Gap 12: Hermes context changes are not represented as AppLoop events

Session creation, restore, fork, resume, rewind, and branch should be explicit event rows with causality. Today they are implicit side effects of stream events and client checkpoint snapshots.

Impact: debugging synchronization requires inferring from scattered rows and checkpoint JSON.

---

## Recommended synchronization design

### Design principle

Make this invariant true:

> Every AppLoop conversation branch has exactly one current real Hermes session ID, and every Hermes run is associated with exactly one AppLoop conversation branch, one message-history prefix, and one file checkpoint.

Project-level `hermesSessionId` should become a convenience pointer to the active conversation’s Hermes session, not the authority for all runs.

### Recommended data model changes

#### 1. Extend `conversations`

Add fields:

- `status`: `active | archived | deleted`
- `kind`: `main | session | branch`
- `parent_conversation_id`: nullable
- `branched_from_message_id`: nullable
- `branched_from_checkpoint_id`: nullable
- `file_snapshot_commit`: nullable
- `hermes_session_id`: real current Hermes session ID or reserved ID
- `hermes_parent_session_id`: nullable
- `hermes_branch_from_message_id`: nullable if Hermes exposes this
- `message_cursor`: integer or timestamp for last synchronized message
- `is_active_for_project`: boolean or store active pointer elsewhere

#### 2. Add project active conversation pointer

Add to `projects`:

- `active_conversation_id`

Then stop selecting the first conversation by project ID in `hydrateProjectOverview()`. Always load the active conversation unless explicitly browsing history.

#### 3. Extend `messages`

Add metadata columns or standardize JSON fields:

- `raw_user_prompt`
- `composed_prompt`
- `visual_selection_json`
- `screenshot_ids_json`
- `checkpoint_before_id`
- `checkpoint_after_id`
- `hermes_message_id` if available
- `hermes_session_id`
- `active` boolean for non-destructive restore/branch operations

At minimum, user messages should preserve raw and composed prompt separately.

#### 4. Extend `chat_checkpoints`

Add:

- `conversation_id`
- `run_id`
- `parent_checkpoint_id`
- `kind`: `prompt-before | prompt-after | session-boundary | restore-point | branch-point`
- `hermes_session_id`
- `hermes_message_cursor` or `hermes_last_message_id`
- `commit_hash`
- `created_by_event_id`

Keep `data_json` for denormalized UI restore data, but make the relational columns queryable.

#### 5. Add `session_events`

Create an append-only event log:

```txt
session_events
- id
- project_id
- conversation_id
- hermes_session_id
- type: project-created | session-created | prompt-submitted | run-started | run-completed | checkpoint-saved | restored | branched | resumed | cancelled | synced
- previous_conversation_id
- previous_hermes_session_id
- checkpoint_id
- run_id
- metadata_json
- created_at
```

This gives observability and a recovery path when sync is interrupted.

#### 6. Add `hermes_session_links`

Create an explicit mapping table:

```txt
hermes_session_links
- id
- project_id
- conversation_id
- hermes_session_id
- source: created | resumed | forked | imported | reserved
- parent_hermes_session_id
- status: active | superseded | archived | invalid
- created_at
- updated_at
```

This prevents ambiguity between project-level and conversation-level session IDs.

---

## Recommended behavior for each operation

### Project creation

1. Create project.
2. Create initial conversation row with `kind: main`, `status: active`.
3. Store `projects.active_conversation_id`.
4. Store `conversations.hermes_session_id = reserved:<conversationId>` rather than `reserved:<projectId>`.
5. Do not treat the reserved ID as real.
6. First run sends `sessionId: null` and includes metadata requesting a session key like `apploop:<projectId>:<conversationId>` if supported.
7. On Hermes `session` event, update only the active conversation and link row, then mirror to project convenience field.

### Prompt submit

1. Resolve `activeConversation` from `projects.active_conversation_id`.
2. Create a `prompt-before` checkpoint in a server transaction before sending to Hermes:
   - conversation ID
   - message history cursor
   - file commit hash
   - selected targets/screenshots
   - current Hermes session ID
3. Persist the user message with:
   - raw prompt
   - composed prompt
   - visual selection JSON
   - screenshot IDs
   - checkpoint-before ID
4. Create run row with:
   - conversation ID
   - session ID at run start
   - checkpoint-before ID
5. Send Hermes payload using **conversation.hermes_session_id**, not project-level session ID.
6. On stream `session`, if a reserved/null session was used, atomically bind the real Hermes session to that conversation.
7. Persist assistant message and run completion.
8. Optionally create a `prompt-after` checkpoint with resulting file commit hash and Hermes session cursor.

### New session

New session should create a real new conversation and a real new Hermes session boundary.

Recommended flow:

1. Flush the current visible session snapshot to its current conversation/checkpoint server-side.
2. Create a new `conversations` row:
   - `kind: session`
   - `parent_conversation_id`: previous active conversation or null depending on desired UX
   - empty message history
   - `hermes_session_id = reserved:<newConversationId>`
3. Create a session-boundary checkpoint for the previous conversation if desired.
4. Update `projects.active_conversation_id` to the new conversation.
5. Clear client chat state.
6. Clear targets/screenshots.
7. Do **not** delete old conversation messages.
8. The first prompt in the new session sends `sessionId: null`; Hermes creates a real new session.
9. Store returned Hermes session ID on the new conversation.

Result: UI, AppLoop DB, and Hermes all agree that this is a new empty session.

### Restore a session from history

Session restore should switch the active conversation, not merely load checkpoint messages into the current `useChat` instance.

Recommended flow:

1. Save current conversation’s latest message snapshot/checkpoint.
2. Identify the target conversation or session checkpoint.
3. Restore generated project files to the checkpoint commit.
4. Set `projects.active_conversation_id = targetConversationId`.
5. Set project convenience `hermes_session_id = targetConversation.hermes_session_id`.
6. Hydrate `useChat` from target conversation messages, not only checkpoint JSON.
7. Restore targets/screenshots from the selected checkpoint.
8. Restart runtime or reload preview as needed.
9. Next run uses target conversation’s real Hermes session.

If the target is only an old checkpoint and no conversation exists for it, create a new branch conversation from that checkpoint first.

### Restore before a prompt

Avoid mutating old history destructively unless the user explicitly wants to rewrite the current branch. Prefer branch-on-restore.

Recommended default flow:

1. Locate the `prompt-before` checkpoint for the clicked message.
2. Restore generated files to its commit hash.
3. Create a new branch conversation:
   - `parent_conversation_id = currentConversationId`
   - `branched_from_message_id = clickedMessage.id`
   - `branched_from_checkpoint_id = checkpoint.id`
   - copy active messages before clicked prompt into the new conversation, or store a cursor into parent history
4. Create or fork a Hermes session corresponding to the same prefix:
   - Preferred: call a Hermes API to fork/rewind from `checkpoint.hermes_session_id` and message cursor.
   - Fallback: create a new Hermes session and send a reconstructed compact conversation prefix as bootstrap context.
5. Set the new branch conversation active.
6. Hydrate UI with messages before clicked prompt.
7. Restore target/screenshot state.
8. Restart runtime.

If destructive restore remains available, it must also call a Hermes rewind/deactivate API or create a new replacement Hermes session. Deleting AppLoop rows alone is insufficient.

### Edit and re-execute

1. Run the restore-before-prompt flow above.
2. Pre-fill the textarea from `messages.raw_user_prompt`, not by splitting rendered composed text.
3. Preserve or reattach prior selections from checkpoint as editable target chips.
4. On send, create a new prompt checkpoint and run in the branch conversation.
5. Never send the edited prompt into the old unrewound Hermes session.

### Resume project/page load

1. Load `projects.active_conversation_id`.
2. Load that conversation’s messages.
3. Load that conversation’s checkpoints.
4. Resolve the conversation’s Hermes session link.
5. If the conversation has `reserved:` but contains messages, mark it inconsistent and either:
   - recover by creating a new Hermes session and replaying/summarizing messages, or
   - require user action.
6. Never load arbitrary first conversation by `project_id`.

### Branching

Add explicit branch UI/state:

- “Restore here” can mean create branch.
- “Rewrite current session” can remain destructive but should be labeled.
- Branch conversations should have titles and parent relationships.
- Branches should have independent Hermes sessions.
- Generated project file state should be restored to branch checkpoint before runs.

---

## Hermes API requirements / integration recommendations

The clean design needs gateway/Hermes support for at least one of these patterns.

### Preferred: native Hermes fork/rewind API

Expose endpoints like:

```txt
POST /v1/sessions
POST /v1/sessions/:sessionId/fork
POST /v1/sessions/:sessionId/rewind
GET  /v1/sessions/:sessionId
GET  /v1/sessions/:sessionId/messages
```

Fork request:

```json
{
  "parent_session_id": "...",
  "up_to_message_id": 123,
  "metadata": {
    "projectId": "...",
    "conversationId": "...",
    "checkpointId": "..."
  }
}
```

This preserves real Hermes tool-message structure and avoids replaying lossy AppLoop-visible messages.

### Acceptable fallback: new Hermes session plus bootstrap history

If Hermes cannot fork/rewind, AppLoop can create a new session and include a compact bootstrap context:

- AppLoop visible messages before branch point.
- Project workspace path.
- File checkpoint commit hash and current files are already restored.
- Agent bundle.
- Explicit note: this is a resumed AppLoop branch from checkpoint X.

This is less faithful because hidden tool results and compressed context are lost, but it is still safer than sending into the stale old session.

### Do not use slash-command session control through `/api/chat`

A prior attempt sent `/new --yes ...` and `/resume ...` as normal chat messages. That failed because:

- `/api/chat` interprets `body.id` as `projectId`.
- Slash commands conflicted with route authorization and session timing.
- The command path did not atomically update AppLoop DB state and Hermes session state.

Session lifecycle should be API-level, not prompt-level.

---

## Concrete implementation plan

### Phase 1: Make AppLoop conversations first-class sessions

- Add `projects.active_conversation_id`.
- Add `conversations.status`, `kind`, parent/branch fields.
- Change project overview hydration to load the active conversation.
- Make New create a new conversation row instead of only clearing `chat.messages`.
- Scope checkpoints by `conversation_id`.
- Change `/api/chat` to use `conversation.hermesSessionId` as the authority.

### Phase 2: Persist prompt composition explicitly

- Store `raw_user_prompt` and `composed_prompt` separately.
- Store `visual_selection_json` and `screenshot_ids_json` separately.
- Render user messages from raw prompt plus collapsible target metadata.
- Edit from raw prompt.
- Recompose on resend using current or restored target selections.

### Phase 3: Add synchronization/event tables

- Add `session_events`.
- Add `hermes_session_links`.
- Extend `runs` with:
  - `hermes_session_id_at_start`
  - `hermes_session_id_at_end`
  - `checkpoint_before_id`
  - `checkpoint_after_id`
- Log every session lifecycle transition.

### Phase 4: Add Hermes session lifecycle integration

- Prefer native fork/rewind endpoints.
- Fallback to new-session bootstrap if native support is unavailable.
- Never mutate AppLoop visible history without updating Hermes session mapping.

### Phase 5: Branch-aware restore/edit UI

- Make Restore default to “restore into new branch”.
- Add explicit “rewrite current branch” for destructive truncation.
- Add session/branch history that lists real conversations, not only checkpoint JSON.
- Show sync status:
  - active conversation ID
  - Hermes session ID
  - last run ID
  - last checkpoint
  - whether AppLoop and Hermes are in sync

### Phase 6: Recovery and validation

Add diagnostics that verify:

- Active project has active conversation.
- Active conversation has a non-reserved Hermes session after first run.
- Last AppLoop run’s Hermes session matches active conversation.
- Checkpoints belong to active conversation.
- No project-level Hermes session overrides a different active conversation session.
- Restored branch file commit exists in the generated project git repo.

---

## Recommended invariants

1. `projects.active_conversation_id` is non-null for active projects.
2. Every run belongs to exactly one conversation.
3. Every conversation has exactly one current Hermes session link.
4. `projects.hermes_session_id`, if retained, mirrors active conversation and is never the authority.
5. New session creates a new conversation and a new real Hermes session.
6. Restore/edit either rewinds/forks Hermes or creates a new replacement Hermes session; it never sends into stale history.
7. Prompt checkpoints are conversation-scoped.
8. Session checkpoints are either conversation records or point to conversation records.
9. User prompt raw text and composed target-enriched text are stored separately.
10. A run stores the checkpoint and Hermes session it started from.
11. Page reload hydrates from the active conversation, not from checkpoint JSON alone.
12. Any DB mutation that changes active conversation/session is transactional and logged as a `session_event`.

---

## Suggested payload contract after synchronization redesign

`/api/chat` should send Hermes:

```json
{
  "projectId": "...",
  "conversationId": "active AppLoop conversation id",
  "messageId": "AppLoop user message id",
  "message": "composed prompt",
  "input": "composed prompt",
  "workspacePath": "...",
  "sessionId": "real Hermes session for this conversation or null",
  "session_id": "same value",
  "checkpointId": "prompt-before checkpoint id",
  "branch": {
    "conversationId": "...",
    "parentConversationId": "...",
    "branchedFromMessageId": "...",
    "branchedFromCheckpointId": "..."
  },
  "agentBundle": { "...": "..." },
  "images": ["optional base64 image attachments"]
}
```

This lets the gateway and Hermes agent attribute all work to the correct AppLoop branch and file checkpoint.

---

## Migration notes

Existing projects may have:

- One conversation per project.
- Project and conversation both pointing at the same real Hermes session.
- Session boundaries only in `chat_checkpoints.data_json`.

Migration approach:

1. For each project, create `active_conversation_id` pointing to the existing conversation.
2. Mark existing conversation `kind: main`, `status: active`.
3. Backfill `hermes_session_links` from `conversations.hermes_session_id` if real.
4. For every `chat_checkpoints` row, set `conversation_id` to the active conversation.
5. Optionally convert `isSessionBoundary` checkpoints with message snapshots into archived conversation rows, but do not do that automatically unless needed. Preserve original checkpoint JSON.
6. Mark any `reserved:` session with existing messages as `needs_recovery`.

---

## Final recommendation

AppLoop should stop treating “session” as a client-side checkpoint label and make it a durable, synchronized conversation branch. The active AppLoop conversation should be the single source of truth for:

- visible message history,
- current file checkpoint lineage,
- active Hermes session ID,
- run identity,
- restore/branch parentage.

Hermes should remain the source of truth for model-facing context, tool history, compression, and provider interaction. AppLoop should not silently diverge from that context. Every operation that changes what the user sees as the current conversation must also change the Hermes session that will receive the next prompt.

Until that invariant is enforced, the highest-risk failure mode remains: **AppLoop displays an empty or restored session while the next prompt resumes a stale Hermes session containing hidden prior prompts and tool results.**
