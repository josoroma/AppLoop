# User Flow: Create Template

This is the end-to-end path for authoring a reusable AppLoop template from the builder UI, as implemented today.

Primary surfaces:

- Listing: `http://localhost:3001/templates`
- Create page: `http://localhost:3001/templates/new`
- Entry from projects: `http://localhost:3001/projects` → **Templates**

---

## Table of contents

1. [Navigate to Templates](#1-navigate-to-templates)
2. [Open Create Template](#2-open-create-template)
3. [What happens while you wait](#3-what-happens-while-you-wait)
4. [Where you land on success](#4-where-you-land-on-success)
5. [Actions and APIs used](#5-actions-and-apis-used)
6. [Database tables touched](#6-database-tables-touched)
7. [Main files that implement this flow](#7-main-files-that-implement-this-flow)
8. [Mental model](#8-mental-model)
9. [Failure modes to know](#9-failure-modes-to-know)
10. [Quick checklist](#10-quick-checklist)

---

## 1. Navigate to Templates

1. Start the builder (typically `make dev` / `npm run dev`) so AppLoop is serving on **`http://localhost:3001`**.
2. Open **`http://localhost:3001/projects`**.
3. In the projects header, click **Templates**.
4. You land on **`/templates`**, which lists built-in and custom templates (paginated).

The listing header includes a top-level **New template** action. That is the preferred entry point; create is **not** a modal anymore.

---

## 2. Open Create Template

1. On `/templates`, click **New template**.
2. You are routed to **`http://localhost:3001/templates/new`**.

The page is a full Luma-styled create flow (`CreateFlowShell` + `TemplateCreateForm`), not a dialog. It asks only for authoring inputs:

| Field | Form name | Required | Purpose |
| --- | --- | --- | --- |
| Template name | `name` | yes | Human label + basis for filesystem/template id slug |
| Short description | `description` | no | Shown in template cards; falls back to a prompt excerpt if empty |
| Template prompt | `prompt` | yes | Brief sent to Hermes for template authoring |
| Theme CSS | `themeCss` | yes | Editable `:root` / `.dark` token block; validated before Hermes runs |

### Example values (particles / shaders landing page)

Use something like:

- **Template name:** `Shader Particles Landing`
- **Short description:** `Single-page landing with mathematical particle shader motion on a dark canvas.`
- **Template prompt:**

```text
Create a single landing page (route "/") that base-clones the default Next.js template and turns the home into a dark, cinematic product landing.

Requirements:
- One primary full-viewport hero section with a native WebGL or canvas particles scene.
- Particles / shaders should feel mathematical: concentric or orbital motion, luminous points, soft trails, blue/pink/purple/white accents.
- Keep copy minimal: eyebrow, headline, short supporting paragraph, one primary CTA.
- Preserve AppLoop inspectability: shared/base classnames plus a unique last classname on every user-visible element.
- Keep components/inspector-provider.tsx and components/theme-provider.tsx compatible.
- Do not add extra marketing routes; one focused landing page is enough.
```

Leave **Theme CSS** as the prefilled Luma/shadcn defaults unless you intentionally want a different token set.

3. Click **Create template**.

A pending overlay appears (`Creating your template with Hermes…`) while the server action runs. Do not close the tab; this request is long-running compared to project creation.

---

## 3. What happens while you wait

Submitting the form posts to the server action `createCustomTemplateAction` in `lib/projects/actions.ts`, which orchestrates:

### A. Local preparation (AppLoop process, no guest chat UI yet)

Implemented in `createCustomTemplate()` (`lib/projects/template-authoring.ts`):

1. **Validate inputs**  
   Trim name/prompt; reject empties. Parse/validate `themeCss` via `createCustomTheme()` (`lib/themes/registry.ts`). Unsupported tokens fail fast here (e.g. custom tokens must be known or ignored).

2. **Resolve base template**  
   Defaults to the built-in default project template unless another base is supplied.

3. **Allocate a unique template id**  
   Derived from the name (`toSafePathSegment`), uniquified against existing built-in + DB templates.

4. **Materialize a new template workspace on disk**  
   - Source: `templates/<baseTemplatePath>/`  
   - Destination: `templates/<newTemplateId>/`  
   - Transient dirs (`.next`, `node_modules`, …) are not copied.

5. **Stamp identity**  
   Rewrite the body classname in `app/layout.tsx` from `template-<base>` to `template-<newId>`.

6. **Apply theme CSS**  
   `applyThemeToWorkspace()` writes validated tokens into the new template’s `app/globals.css`.

7. **Register a DB row**  
   `project_templates` with:
   - `source: "custom"`
   - `status: "generating"`
   - `sourcePrompt`, `baseTemplateId`, `defaultThemeId`, paths, etc.

At this moment the template exists on disk and in the DB as **generating**, but Hermes has not finished authoring UI changes yet.

### B. Hermes gateway conversation (backend-only authoring run)

Still inside `createCustomTemplate()`, AppLoop calls:

```ts
getHermesClient().runProjectOnce({ ... })
```

This is a **one-shot gateway run**, not the interactive builder chat on `/projects/[id]`.

Important details:

| Concern | Behavior |
| --- | --- |
| Transport | Hermes client → local Hermes gateway HTTP (`run` + event stream), configured via env (`HERMES_BASE_URL`, key, model/provider) |
| Synthetic project id | `template:<templateId>` (not a normal user project id) |
| Workspace path | The new `templates/<templateId>` directory |
| Session | Starts with `sessionId: null` for a fresh authoring session; Hermes may return a session id stored on the template row |
| Agent bundle | `createProjectAgentBundle(..., mode: "template-authoring")` — orchestrator + specialists from `.hermes/agents`, plus `/ui-builder` bundle, skills, hooks, commands |
| Message | A structured authoring prompt including name, template id/body classname, base template, description, user brief, and the already-applied theme CSS |

What Hermes is doing conceptually:

1. Receive the agent bundle + workspace path from AppLoop.
2. Load AppLoop’s repo-local agents / skills / hooks / commands (not a blank model chat).
3. Edit only the new template workspace (pages, components, CSS as needed for the particles landing brief).
4. Keep inspectable classnames and provider compatibility.
5. Run whatever narrow validation the agents choose inside that workspace.
6. Stream run events back over the gateway until completion/failure.

AppLoop app code **owns** filesystem staging, DB status, and later edit-project bootstrap. Hermes **owns** the generative edit loop for template contents during this run.

### C. Readiness gate

After the gateway run returns successfully, AppLoop:

1. Asserts required template files exist (`package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, inspector/theme providers, etc.).
2. Confirms `layout.tsx` still contains `template-<templateId>`.
3. Updates the template row to `status: "ready"` and stores Hermes run/session ids.

If Hermes or readiness fails, the row becomes `status: "failed"` with `lastError`, and the server action throws (you stay off the happy-path redirect).

### D. Open template for editing + hard redirect

Back in `createCustomTemplateAction`, on success:

1. Call `openTemplateForEditing(repository, template.id)`.
2. That binds the finished template directory as a special **project bundle**:
   - Project name shaped like `Template: <name>`
   - `workspacePath` points at `templates/<templateId>` (the live template source, not a `.apploop/projects/...` clone)
   - Fresh conversation + Hermes session reservation + preview port allocation
3. `revalidatePath` for `/projects` and `/templates`.
4. **`redirect(`/projects/${projectId}`)`**.

---

## 4. Where you land on success

**Success URL:** `http://localhost:3001/projects/<projectId>`

That is the normal builder shell for the template-edit project:

- Chat is backed by the reserved Hermes session for this template-edit workspace.
- Preview targets the template workspace runtime when started.
- Further conversational edits use the standard `/api/chat` + gateway path with **template-scoped** guardrails (edit this template, preserve identity/classnames/providers).

So the wait is long during create because Hermes authors the first version of the template **before** redirect. After redirect, additional Hermes chat turns are the interactive conversation you see in the sidebar UI.

---

## 5. Actions and APIs used

Create Template is **not** primarily a REST `fetch` from the browser beyond Next’s form/server-action transport. The important call boundaries:

### Browser → AppLoop (user actions)

| UI step | Mechanism | Target |
| --- | --- | --- |
| Open listing | `GET /templates` | RSC page `app/templates/page.tsx` |
| Open create | navigation `Link` | `GET /templates/new` → `app/templates/new/page.tsx` |
| Submit create | HTML form `action={createCustomTemplateAction}` | Server Action `createCustomTemplateAction` |
| After redirect | `GET /projects/[projectId]` | builder page `app/projects/[projectId]/page.tsx` |

Related listing actions (not required for create, but same surface):

- `editTemplateAction` — open/edit existing template
- `cloneTemplateAction` — clone template row + disk
- `deleteTemplateAction` — remove custom template

### AppLoop → Hermes gateway (during create wait)

| Call site | Client method | Gateway meaning |
| --- | --- | --- |
| `createCustomTemplate()` | `getHermesClient().runProjectOnce(...)` | Start one-shot run with agent bundle + authoring message |
| Hermes client internals | HTTP run start + SSE/event stream | Stream tool/file events until terminal status |

Config path: `lib/hermes/config.ts` / env (`HERMES_BASE_URL`, auth, model). Implementation: `lib/hermes/client.ts`.

### After success (interactive phase — not part of create form, but same product loop)

| API | When |
| --- | --- |
| `POST /api/chat` | User sends builder prompts on the template-edit project |
| `POST /api/chat/cancel` | Cancel in-flight Hermes run |
| Runtime actions (start/stop preview) | Preview lifecycle for template workspace |

### Sequence diagram (create only)

```text
Browser                    Next server action                 SQLite                    FS                        Hermes gateway
  |                               |                             |                        |                              |
  |-- POST createCustomTemplate ->|                             |                        |                              |
  |                               |-- list/find templates ----->|                        |                              |
  |                               |-- createTheme/validate                                |                              |
  |                               |-- cp base -> templates/id --------------------------->|                              |
  |                               |-- insert project_templates (generating) ------------>|                        |                              |
  |                               |-- runProjectOnce() ------------------------------------------------------------------->|
  |                               |<- events / completion -----------------------------------------------------------------|
  |                               |-- mutate workspace files (via Hermes tools) --------->|                              |
  |                               |-- update project_templates (ready|failed) ---------->|                        |                              |
  |                               |-- createProjectBundle (edit project) --------------->|                        |                              |
  |<- redirect /projects/:id -----|                             |                        |                              |
```

---

## 6. Database tables touched

Schema source of truth: `lib/db/schema.ts`.

### During Create Template itself

| Table | Access | What / why |
| --- | --- | --- |
| `project_templates` | **QUERY** `listProjectTemplates` | Uniquify new template id against existing custom templates |
| `project_templates` | **QUERY** `findProjectTemplateById` | Resolve custom base templates if requested |
| `project_templates` | **INSERT** | Row for the new custom template (`status=generating`, prompt/path/base) |
| `project_templates` | **UPDATE** | `status=ready` + `hermesRunId` / `hermesSessionId`, or `status=failed` + `lastError` |

Built-in templates are **not** DB rows; they come from in-code registry (`lib/projects/templates.ts`) and are only unioned at read time.

### During `openTemplateForEditing` on success

Creates a full project bundle via `createProjectBundle`:

| Table | Access | Notes |
| --- | --- | --- |
| `projects` | **QUERY** list/find | Reuse existing active edit project for same `workspacePath` if present; else allocate slug/id |
| `projects` | **INSERT** | `name` like `Template: …`, `workspacePath` = `templates/<id>`, reserved port/session |
| `conversations` | **INSERT** | Main chat (`kind=main`, title `… template edit`) |
| `runtimes` | **INSERT** | `status=stopped`, `previewUrl` for allocated port |
| `project_themes` | **INSERT** | Template default theme id |
| `project_settings` | **INSERT** | Defaults (`packageInstallPolicy`, `validationDepth`, `autoStartPreview`, `defaultRoute`) |

Port uniqueness is enforced against existing `projects.preview_port` / runtime ports discovered from **QUERY** overviews (`projects` + joined `runtimes`).

### Not written during create form success path

These matter later in the builder, after redirect, not during the create server action:

- `messages`, `runs`, `chat_checkpoints`, `session_events`, `hermes_session_links`, `screenshots`, `git_commits`, `project_snapshots`
- `builder_preferences` may update when the project is opened later (`rememberLastOpenedProject`) depending on shell paths

### Status lifecycle for `project_templates.status`

```text
(none)
  └─ INSERT generating
        ├─ Hermes OK + readiness OK → UPDATE ready
        └─ Hermes/assert fail        → UPDATE failed (+ lastError)
```

---

## 7. Main files that implement this flow

### UI / routing layer

| File | Role |
| --- | --- |
| `app/projects/page.tsx` | Projects listing; **Templates** link entry |
| `app/templates/page.tsx` | Template listing + **New template** CTA; edit/clone/delete forms |
| `app/templates/new/page.tsx` | Create Template page shell |
| `components/projects/create-flow-shell.tsx` | Shared Luma create layout |
| `components/projects/template-create-form.tsx` | Create form fields + pending overlay; `action={createCustomTemplateAction}` |
| `app/globals.css` | Luma list/create page chrome |
| `app/projects/[projectId]/page.tsx` | Success landing builder surface |
| `components/builder/*` | Chat/preview shell used after redirect |

### Server actions + orchestration

| File | Role |
| --- | --- |
| `lib/projects/actions.ts` | `createCustomTemplateAction`, `editTemplateAction`, …; redirect after success |
| `lib/projects/template-authoring.ts` | `createCustomTemplate`, `openTemplateForEditing`, listing helpers, readiness/stamp/prompt builders |
| `lib/projects/templates.ts` | Built-in template registry + `assertProjectTemplate` / `listProjectTemplates` |
| `lib/projects/service.ts` | Slug/port helpers reused by template-edit project bootstrap |
| `lib/projects/store.ts` | `getProjectRepository` / `getProjectService` wiring |

### Persistence

| File | Role |
| --- | --- |
| `lib/db/schema.ts` | Table definitions (`project_templates`, project bundle tables) |
| `lib/db/repository.ts` | Repository interface |
| `lib/projects/repository.ts` | SQLite implementation: `createProjectTemplate`, `updateProjectTemplate`, `createProjectBundle`, listings |

### Theme + filesystem

| File | Role |
| --- | --- |
| `lib/themes/registry.ts` | `createCustomTheme` / token validation / serialization |
| `lib/themes/apply.ts` | Apply tokens onto template `app/globals.css` |
| `lib/security/paths.ts` | Path containment for `templates/` |
| `templates/<base>/…` | Source tree copied into `templates/<newId>/` |
| `templates/<newId>/…` | Generated custom template workspace (Hermes edits here) |

### Hermes integration

| File | Role |
| --- | --- |
| `lib/hermes/store.ts` | `getHermesClient()` |
| `lib/hermes/client.ts` | Gateway HTTP + event stream (`runProjectOnce`) |
| `lib/hermes/config.ts` | Base URL / auth / model resolution |
| `lib/hermes/agents.ts` | `createProjectAgentBundle` for `template-authoring` |
| `lib/hermes/skills.ts`, `hooks.ts`, `commands.ts` | Bundle constituents referenced by agents |
| `.hermes/agents/*`, `.hermes/bundles/ui-builder/*`, `.hermes/skills/*` | Repo-local agent assets uploaded/referenced by the bundle |

### Compound diagram

```text
app/templates/new/page.tsx
        │
        ▼
template-create-form.tsx  ──form action──►  actions.createCustomTemplateAction
                                                     │
                                                     ├─► template-authoring.createCustomTemplate
                                                     │         ├─ themes/registry + themes/apply
                                                     │         ├─ templates/* (FS)
                                                     │         ├─ repository project_templates INSERT/UPDATE
                                                     │         └─ hermes/client.runProjectOnce + agents bundle
                                                     │
                                                     └─► template-authoring.openTemplateForEditing
                                                               └─► repository.createProjectBundle
                                                                         └─ projects/conversations/runtimes/themes/settings
                                                     │
                                                     ▼
                                              redirect /projects/:id
                                                     │
                                                     ▼
                                   app/projects/[projectId]/page.tsx + builder shell
                                                     │
                                           (later) /api/chat → Hermes
```

---

## 8. Mental model

```text
Browser  →  POST createCustomTemplateAction
         →  validate theme CSS + copy base template to templates/<id>
         →  status=generating
         →  Hermes gateway runProjectOnce (template-authoring agents)
         →  mutate files in templates/<id>
         →  status=ready
         →  openTemplateForEditing (create project row wired to that path)
         →  303/redirect /projects/<projectId>
Browser  →  builder chat UI for Template: …
```

**Template creation is generative and network-bound to Hermes.**  
**Project creation (separate flow) is mostly local copy + metadata.** Do not expect the same wait length.

---

## 9. Failure modes to know

- Invalid theme CSS → fails before Hermes.
- Hermes gateway down / auth / timeout → template may end `failed`; no edit redirect.
- Readiness assertion fails even after Hermes “success” → treated as failure.
- Built-in templates on the listing are not deleted from this flow; only custom rows are removable after landing back on `/templates`.

---

## 10. Quick checklist

- [ ] Builder at `http://localhost:3001/projects`
- [ ] **Templates** → **New template**
- [ ] Fill name, description, particles/shaders prompt (+ theme CSS if needed)
- [ ] Wait through Hermes authoring overlay
- [ ] Confirm redirect to `/projects/<id>` titled like `Template: …`
- [ ] Confirm `/templates` eventually shows the new custom template as ready
- [ ] Optional: inspect SQLite `project_templates` (`generating` → `ready`) and new project bundle rows
