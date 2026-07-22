# User Flow: Create Project

This is the end-to-end path for spinning up an editable AppLoop project from a template, as implemented today.

Primary surfaces:

- Listing: `http://localhost:3001/projects`
- Create page: `http://localhost:3001/projects/new`

---

## Table of contents

1. [Navigate to Create Project](#1-navigate-to-create-project)
2. [Fill the create form](#2-fill-the-create-form)
3. [What happens while you wait](#3-what-happens-while-you-wait)
4. [Gateway vs local — when does conversation happen?](#4-gateway-vs-local--when-does-conversation-happen)
5. [Where you land on success](#5-where-you-land-on-success)
6. [Actions and APIs used](#6-actions-and-apis-used)
7. [Database tables touched](#7-database-tables-touched)
8. [Main files that implement this flow](#8-main-files-that-implement-this-flow)
9. [Mental model](#9-mental-model)
10. [Failure modes to know](#10-failure-modes-to-know)
11. [Quick checklist](#11-quick-checklist)

---

## 1. Navigate to Create Project

1. Start the builder so AppLoop is serving on **`http://localhost:3001`**.
2. Open **`http://localhost:3001/projects`**.
3. In the projects header, click **New project**.
4. You are routed to **`http://localhost:3001/projects/new`**.

Create project is a **full page** (`CreateFlowShell` + `ProjectCreateForm`), not a modal.

---

## 2. Fill the create form

On `/projects/new` you choose:

| Field | Form name | Required | Purpose |
| --- | --- | --- | --- |
| Project name | `name` | yes | Display name + slug basis for the workspace folder |
| Template | `templateId` (hidden, from radio UI) | yes | Which `templates/<path>` blueprint to copy |
| Theme | `themeId` (hidden, from radio UI) | yes | Token set to apply after copy (may stay on template default) |

### Example: AI Engineer CV

1. **Project name:** e.g. `Joso AI Engineer CV`
2. Under **Template**, select **AI Engineer CV** (id typically `ai-engineer-cv` / specialty CV template).
3. Under **Theme**, keep the template default unless you want an override (CV templates often ship with a dark indigo-oriented default).
4. Click **Create project**.

A pending overlay shows `Creating your project…`. This wait is usually **short** compared to Create Template, because project creation is primarily local I/O + DB work.

---

## 3. What happens while you wait

Submitting the form posts to `createProjectAction` in `lib/projects/actions.ts`.

There is **no Hermes gateway conversation during project create**. Hermes becomes involved later, when you send chat prompts inside the builder.

### A. Resolve template + theme (local)

1. Read `name`, `templateId`, `themeId` from the form.
2. Resolve the selectable template:
   - Built-in via `assertProjectTemplate`, or
   - Custom DB template if `status === "ready"`.
3. Resolve theme:
   - If the template is custom **and** the chosen theme id is exactly the template’s `defaultThemeId`, AppLoop may skip a separate theme overlay (custom templates often bake tokens into their globals already).
   - Otherwise `assertProjectTheme(themeId)` loads a built-in theme definition.

### B. Create project domain records (local DB + port allocation)

`ProjectService.createProject()` (via `getProjectService()`):

1. Validates the project name schema.
2. Allocates a **unique slug** under the projects root.
3. Reserves a **preview port** in the builder’s port range (commonly `3100–3199` class ports; exact allocator lives in project service).
4. Creates a **project bundle**:
   - `projects` row (id, name, slug, workspacePath, previewPort, themeId, …)
   - active **conversation** row
   - reserved **Hermes session id** for future chat (reservation only — no run yet)
   - **runtime** row (`stopped`, with preview URL host/port)
   - **theme** row
   - **settings** defaults (install policy, validation depth, auto-start preview, default route, …)

This is all **AppLoop-local** process + SQLite (or configured DB). The gateway is not called here.

### C. Materialize the workspace on disk (local filesystem)

`createProjectWorkspace(projectsRoot, workspacePath, { template, theme })` in `lib/projects/files.ts`:

1. Ensure projects root exists (`.apploop/projects` / env `PROJECTS_ROOT`).
2. **Copy** `templates/<template.templatePath>/` → the new project workspace path.
3. Filter out transient dirs (`.next`, `node_modules`, etc.).
4. If a theme object is provided, **apply theme tokens** to the workspace `app/globals.css`.
5. Initialize a **git repo** in the workspace for checkpoints / recovery (local `git init` + initial commit style setup).

For **AI Engineer CV**, the copied tree already contains the specialty CV layout, pages, identity classname (`template-ai-engineer-cv` on body), inspector provider, and CV-specific styling. Create project does not regenerate CV content via Hermes; it clones the template as-is.

### D. Bookkeeping + redirect

1. `rememberLastOpenedProject(project.id)` so the builder can treat it as most recent.
2. `revalidatePath("/projects")`.
3. **`redirect(`/projects/${project.project.id}`)`**.

---

## 4. Gateway vs local — when does conversation happen?

| Phase | Local AppLoop | Hermes gateway |
| --- | --- | --- |
| Click Create project | Yes: DB, FS copy, theme apply, git init | **No** |
| Overlay “Creating…” | Server action still running in Next.js | **No** |
| Landing on `/projects/[id]` | Render builder shell, load overview | Still idle until chat |
| First user prompt in chat | `/api/chat` assembles agent bundle + workspace context | **Yes** — interactive run for edits |
| Preview start | Runtime service spawns `next dev` (or equivalent) on allocated port | No (unless a prompt causes runtime tools later) |

So: **create project wait = local scaffolding.**  
**Conversation through the gateway = after redirect, when you prompt in the builder.**

That is intentionally different from **Create Template**, which performs a full `runProjectOnce` authoring pass on the gateway *before* redirect.

---

## 5. Where you land on success

**Success URL:** `http://localhost:3001/projects/<projectId>`

You are in the project builder:

- Left/main chat uses the reserved Hermes session id once you submit messages.
- Preview iframe points at the project’s allocated preview URL/port once runtime is started (auto-start depends on project settings).
- Workspace on disk is the independent project copy under the projects root, **not** the ambient `templates/ai-engineer-cv` source (unless you used a special template-edit project; those are a different entry from Templates → Edit).

Further AI edits:

```text
Browser chat → POST /api/chat
            → AppLoop builds createProjectAgentBundle (agents/skills/hooks/commands)
            → Hermes gateway streaming run against the project workspace
            → File changes + optional validation/repair agents
            → UI streams tokens/status back into the conversation
```

Chat checkpoints / restore-edit conversation behavior apply **here**, after the project exists—not during the create form wait.

---

## 6. Actions and APIs used

### Browser → AppLoop (user actions)

| UI step | Mechanism | Target |
| --- | --- | --- |
| Open listing | `GET /projects` | RSC page `app/projects/page.tsx` |
| Open create | navigation `Link` | `GET /projects/new` → `app/projects/new/page.tsx` |
| Submit create | HTML form `action={createProjectAction}` | Server Action `createProjectAction` |
| After redirect | `GET /projects/[projectId]` | builder page `app/projects/[projectId]/page.tsx` |

There is **no** Hermes gateway call inside `createProjectAction`.

### Supporting reads on the create page (SSR)

`app/projects/new/page.tsx` loads selectable templates via:

- `listSelectableProjectTemplates(getProjectRepository())`
  - built-ins from `lib/projects/templates.ts`
  - custom ready rows from `project_templates` (`status='ready'`)

Themes rendered in the form come from in-memory `BUILT_IN_PROJECT_THEMES` (`lib/themes/registry.ts`), not a themes table.

### After success (interactive phase — not create submit)

| API / action | When |
| --- | --- |
| `POST /api/chat` | First and subsequent builder prompts → Hermes gateway |
| `POST /api/chat/cancel` | Cancel in-flight run |
| Runtime start/stop actions (`lib/runtime/actions.ts`) | Preview process lifecycle |
| Settings / theme update actions | Later mutations of `project_settings` / `project_themes` |

### Sequence diagram (create only)

```text
Browser                 createProjectAction              SQLite                     FS (templates + projects root)      Hermes
  |                            |                            |                              |                              |
  |-- POST createProject ----->|                            |                              |                              |
  |                            |-- resolve template/theme   |                              |                              |
  |                            |   (built-in registry and/or project_templates QUERY)       |                              |
  |                            |-- list projects/overviews ->|  (slug + port allocation)   |                              |
  |                            |-- createProjectBundle ---->|  INSERT projects/            |                              |
  |                            |                            |  conversations/runtimes/     |                              |
  |                            |                            |  project_themes/settings     |                              |
  |                            |-- createProjectWorkspace -------------------------------->|  cp template → workspace      |(idle)
  |                            |-- applyTheme (optional) ---------------------------------->|  patch globals.css            |
  |                            |-- git init ----------------------------------------------->|                              |
  |                            |-- rememberLastOpened ----->|  UPSERT builder_preferences  |                              |
  |<- redirect /projects/:id --|                            |                              |                              |
  |                            |                            |                              |                              |
  |  (later chat) POST /api/chat ......................................................................................► gateway
```

---

## 7. Database tables touched

Schema source of truth: `lib/db/schema.ts`. SQLite access path: `lib/projects/repository.ts` via `createProjectBundle` / preference helpers.

### During Create Project submit

| Table | Access | What / why |
| --- | --- | --- |
| `projects` | **QUERY** `listProjects` / overviews / ports | Unique slug; allocate free `preview_port` |
| `runtimes` | **QUERY** (via overviews) | Avoid colliding runtime ports |
| `project_templates` | **QUERY** (optional) | Only if selected template is a custom ready template, not a built-in |
| `projects` | **INSERT** | New project row (`status=active`, workspace path, themeId, reserved hermes/session/conversation ids, port) |
| `conversations` | **INSERT** | Main chat (`kind=main`, title `"<name> chat"`) |
| `runtimes` | **INSERT** | `status=stopped`, port + `previewUrl` |
| `project_themes` | **INSERT** | Selected theme id (+ optional `token_json` only on other flows with custom themes) |
| `project_settings` | **INSERT** | Defaults: package install policy, validation depth, auto-start preview, default route |
| `builder_preferences` | **UPSERT/UPDATE** | `last_opened_project_id` via `rememberLastOpenedProject` |

Built-in theme catalog and AI Engineer CV template metadata are **code**, not DB rows.

### Not written during create submit

These appear later once the builder runs chat / checkpoints / recovery:

| Table | Later phase |
| --- | --- |
| `messages` | Chat turns |
| `runs` | Hermes run bookkeeping for `/api/chat` |
| `chat_checkpoints` | Prompt/session checkpoints, restore points |
| `session_events` | `project-created` may be recorded depending on higher-level session instrumentation; core create bundle path above is the minimal durable write set |
| `hermes_session_links` | Session linking when chat starts / resumes |
| `screenshots` | Inspector/clipboard captures |
| `git_commits` / `project_snapshots` | Checkpoint/recovery artifacts after edits |

Note: workspace **git** is initialized on disk during create; that does not necessarily insert `git_commits` rows until a later tracked commit event.

### Project row lifecycle (create path)

```text
INSERT projects.status = active
  workspace = PROJECTS_ROOT/<slug>
  previewPort unique
  hermesSessionId reserved (unused until chat)
  activeConversationId -> conversations.id
```

---

## 8. Main files that implement this flow

### UI / routing layer

| File | Role |
| --- | --- |
| `app/projects/page.tsx` | Projects listing; **New project** → `/projects/new` |
| `app/projects/new/page.tsx` | Create Project page; loads selectable templates SSR |
| `components/projects/create-flow-shell.tsx` | Shared Luma create shell |
| `components/projects/project-create-form.tsx` | Name/template/theme form + pending overlay; `action={createProjectAction}` |
| `app/globals.css` | Luma listing/create chrome |
| `app/projects/[projectId]/page.tsx` | Success landing builder route |
| `components/builder/*` | Chat, preview, checkpoints after redirect |

### Server actions + domain services

| File | Role |
| --- | --- |
| `lib/projects/actions.ts` | `createProjectAction` (resolve template/theme → create → workspace → remember → redirect) |
| `lib/projects/service.ts` | `ProjectService.createProject`, slug/port helpers, settings schemas |
| `lib/projects/store.ts` | Service/repository accessors |
| `lib/projects/files.ts` | `createProjectWorkspace` (copy template, theme apply, git init) |
| `lib/projects/templates.ts` | Built-in templates (includes AI Engineer CV metadata/path) |
| `lib/projects/template-authoring.ts` | `listSelectableProjectTemplates` for create-page options; custom DB templates union |
| `lib/runtimeing:` wait — correct path is `lib/runtime/ports.ts` | Preview port range + allocation helpers used by service |

### Theme

| File | Role |
| --- | --- |
| `lib/themes/registry.ts` | Built-in themes, `assertProjectTheme`, optional custom theme handling |
| `lib/themes/apply.ts` | Write tokens into workspace `app/globals.css` |
| `lib/themes/catalog.ts` | Default theme constants |

### Persistence

| File | Role |
| --- | --- |
| `lib/db/schema.ts` | `projects`, `conversations`, `runtimes`, `project_themes`, `project_settings`, `builder_preferences`, `project_templates` |
| `lib/db/repository.ts` | Repository contract (`createProjectBundle`, preference APIs) |
| `lib/projects/repository.ts` | SQLite implementation of bundle insert + listings |

### Security / env

| File | Role |
| --- | --- |
| `lib/security/paths.ts` | Ensure workspace stays under projects root |
| `lib/env/server.ts` | `PROJECTS_ROOT` and related server config |

### Hermes (post-create only)

| File | Role |
| --- | --- |
| `app/api/chat/route.ts` | Interactive builder chat after redirect |
| `lib/hermes/client.ts` + `agents.ts` | Gateway runs once user messages |
| `.hermes/**` | Agents/skills/hooks/commands consumed by later chat, not create |

### Compound diagram

```text
app/projects/new/page.tsx
        │ listSelectableProjectTemplates()
        ▼
project-create-form.tsx ──form action──► actions.createProjectAction
                                              │
                                              ├─► resolveSelectableProjectTemplate
                                              │      ├─ templates.ts (built-in)
                                              │      └─ repository.findProjectTemplateById (custom ready)
                                              │
                                              ├─► ProjectService.createProject
                                              │      └─ repository.createProjectBundle
                                              │            ├ projects
                                              │            ├ conversations
                                              │            ├ runtimes
                                              │            ├ project_themes
                                              │            └ project_settings
                                              │
                                              ├─► files.createProjectWorkspace
                                              │      ├ templates/<id> → PROJECTS_ROOT/<slug>
                                              │      ├ themes/apply (optional)
                                              │      └ git init
                                              │
                                              ├─► rememberLastOpenedProject (builder_preferences)
                                              └─► redirect /projects/:id
                                                      │
                                                      ▼
                                        builder shell + (later) /api/chat → Hermes
```

---

## 9. Mental model

```text
Browser  →  POST createProjectAction
         →  resolve AI Engineer CV template + theme
         →  allocate slug, port, conversation, hermesSessionId (unused run yet)
         →  fs.cp templates/ai-engineer-cv → .apploop/projects/<slug>
         →  optional applyThemeToWorkspace
         →  init git
         →  303/redirect /projects/<projectId>
Browser  →  builder shell
User     →  first chat message
         →  Hermes gateway generative session begins
```

**Latency expectation:** seconds for clone + DB (disk speed dominant), not a multi-minute model authoring loop—unless a later chat prompt requires heavy generation.

---

## 10. Failure modes to know

- Unknown / non-ready template id → action throws before workspace copy.
- Unknown theme id → throws from `assertProjectTheme`.
- Destination workspace already exists → copy `errorOnExist` fails.
- Port exhaustion in preview range → allocation error from project service.
- Bundle insert failure rolls back the project row best-effort in repository error path.
- Gateway being down **does not** block create project; it only blocks subsequent chat/preview-agent workflows.

---

## 11. Quick checklist

- [ ] Open `http://localhost:3001/projects`
- [ ] **New project** → `/projects/new`
- [ ] Name project; select **AI Engineer CV**; optionally adjust theme
- [ ] Submit and wait for brief local create overlay
- [ ] Confirm redirect to `/projects/<id>`
- [ ] Confirm CV template UI appears in preview after runtime start
- [ ] Optional: verify new rows in `projects`, `conversations`, `runtimes`, `project_themes`, `project_settings`, and `builder_preferences.last_opened_project_id`
- [ ] Optional: send a chat prompt and observe Hermes gateway-backed edits via `/api/chat`
