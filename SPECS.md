# SPECS.md — AppLoop (Hermes Next.js Visual App Builder)

> Version: 1.0.0 | Last updated: 2026-07-21  
> Status: Implementation source of truth for what AppLoop **currently ships**  
> Companion narrative docs: `README.md`, `docs/README-*.md`, `docs/README-*.html`

---

## Legend

- `[ ]` Todo — Not started / not shipped
- `[~]` In Progress — Partially implemented or intentionally limited
- `[x]` Completed — Implemented and used in the product path
- `[!]` Blocked — Waiting on an external dependency
- Uses `/frontend-design` skill — UI-intensive story requiring the design system
- Uses `/project-runtime` skill — Generated-project process and preview lifecycle
- Uses `/hermes-gateway` skill — Hermes streaming and session integration
- Uses `/visual-selector` skill — iframe element inspection and boundary targeting
- Uses `/theme-system` skill — shadcn/Luma theme selection and application
- Uses `/generated-app-standards` skill — mandatory generated-code conventions
- Uses `/security-review` skill — path, process, iframe, and project isolation review

---

## Progress Summary

| Epic | Stories | Todo | In Progress | Completed | Blocked |
|---|---:|---:|---:|---:|---:|
| E1: Repository & Builder Foundation | 5 | 0 | 0 | 5 | 0 |
| E2: Project Management | 6 | 0 | 0 | 6 | 0 |
| E3: Generated Project Runtime | 6 | 0 | 0 | 6 | 0 |
| E4: Hermes Backend & Streaming Chat | 6 | 0 | 0 | 6 | 0 |
| E5: Hermes Agent Architecture | 5 | 0 | 0 | 5 | 0 |
| E6: Hermes Skills & Bundles | 6 | 0 | 0 | 6 | 0 |
| E7: Hermes Hooks & Commands | 6 | 0 | 0 | 6 | 0 |
| E8: Live Preview Browser | 5 | 0 | 0 | 5 | 0 |
| E9: Visual Element Selection | 7 | 0 | 0 | 7 | 0 |
| E10: shadcn/Luma Theme System | 6 | 0 | 0 | 6 | 0 |
| E11: Generated App Code Standards | 5 | 0 | 0 | 5 | 0 |
| E12: File Generation & Editing | 5 | 0 | 0 | 5 | 0 |
| E13: Validation & Repair Loop | 5 | 0 | 0 | 5 | 0 |
| E14: Persistence, Checkpoints & Recovery | 7 | 0 | 0 | 7 | 0 |
| E15: Security & Isolation | 7 | 0 | 0 | 7 | 0 |
| E16: UX, Accessibility & Responsiveness | 5 | 0 | 0 | 5 | 0 |
| E17: Testing & Observability | 6 | 0 | 1 | 5 | 0 |
| E18: Template Authoring & Template Edit | 6 | 0 | 0 | 6 | 0 |
| E19: Deployment & Remote Runtimes | 5 | 5 | 0 | 0 | 0 |
| **Total** | **109** | **5** | **1** | **103** | **0** |

---

## Product Definition

AppLoop is a **local-first**, project-based visual Next.js application builder.

A user manages projects and templates in the builder dashboard, opens a project builder shell, talks to Hermes through a Vercel AI SDK chat on the left, and sees a **real running** generated Next.js app in a browser-like iframe on the right.

The builder connects to a **local Hermes gateway**. Vercel AI SDK is the chat/stream abstraction. Hermes executes agent workflows against an explicit workspace path using a repo-local agent bundle assembled by AppLoop.

Streaming is required. Assistant text, observable agent activity, and run status arrive progressively.

The builder application and generated applications are **separate Next.js processes**.

```text
Main Builder Next.js App
http://localhost:3001

├── /projects                  inventory + New project
├── /projects/new              full-page create project
├── /templates                 inventory + New template
├── /templates/new             full-page create template
├── /projects/[projectId]      BuilderShell
│   ├── Left column
│   │   └── Vercel AI SDK chat (useChat id=projectId)
│   │       └── POST /api/chat
│   │           └── Hermes gateway REST stream
│   │               http://127.0.0.1:8642
│   │               agentBundle from .hermes/*
│   └── Right column
│       └── PreviewFrame iframe
│           └── Generated Next.js app
│               http://127.0.0.1:3100–3199
└── Runtime manager
    ├── Project filesystem (.apploop/projects or templates/)
    ├── Port allocation
    ├── Process lifecycle
    ├── Logs
    └── Health / restart
```

Each project owns:

- A generated Next.js source tree (or a bound template workspace for template-edit)
- A Hermes conversation/session reservation
- A selected shadcn/Luma theme
- A preview port and runtime process record
- Chat history (SQLite messages)
- Runtime logs
- Git checkpoints for restore/edit
- Optional visual selection context on send
- Settings (package policy, validation depth, auto-start, default route)

The iframe displays a real running Next.js development server. It is not a screenshot, static HTML fragment, or host deployment by default.

### Demo / launch references

- Product Hunt: https://www.producthunt.com/products/apploop-2?launch=apploop-2
- Videos: https://www.youtube.com/watch?v=jPHKrebwvyA · https://www.youtube.com/watch?v=RIXMJz4d5Es · https://www.youtube.com/watch?v=eZhgSQLvL6c · https://www.youtube.com/watch?v=kwJOute_Ej0

### Wireframe / screenshot references

Layout intent references may live under `docs/` (wireframes and screenshots). Implementation stories must match **this specification and the live code**, using images only for spatial intent.

---

## Global Product Constraints

1. The main builder runs independently from all generated applications.
2. Each generated project uses a separate filesystem root under `.apploop/projects/<slug>` (except template-edit, which binds `templates/<id>`).
3. Each active generated project uses a unique preview port in the configured range (default `3100–3199`).
4. Each project maps to an independent Hermes session id (reserved at create; used on chat).
5. Hermes must receive an explicit `workspacePath` on every project-scoped run.
6. Browser-provided paths, ports, process IDs, and Hermes session IDs are never trusted.
7. Hermes / provider API keys remain server-side.
8. Hermes backend access uses server-side clients only (`lib/hermes/client.ts`).
9. Chat output streams progressively through Vercel AI SDK UI streams.
10. Observable agent actions stream as structured activity events (not private chain-of-thought).
11. Private model reasoning is never presented as activity.
12. Generated project changes appear through Next.js HMR / reload (polling and cache-bust supported).
13. Theme selection is stored per project.
14. Selected visual elements are referenced through classnames; **preferredSelector is the last classname**.
15. Generated / template UI must follow inspectable classname and code standards.
16. Deployment / remote runtimes are **out of MVP** and remain epic E19.
17. Create Project does **not** call Hermes; Create Template **does** (`runProjectOnce`).
18. Primary create workflows are **full page routes**, not modal dialogs.

---

## Ownership Boundary

| Owner | Owns |
| --- | --- |
| AppLoop | SQLite, project/template inventory, preview process lifecycle, theme apply, path/command security, agentBundle assembly, chat durability, redirects |
| Hermes | Generative reasoning/tools inside the provided workspace, file edits during runs, validation tools inside that workspace |
| Browser | Inspect selection UI, composer, stream rendering, panel layout — never secrets or authoritative FS authority |

---

# E1: Repository & Builder Foundation

## US-1.1: Initialize the Main Next.js Builder [x]

As a developer I want a strict Next.js App Router project for the builder so that the product has a reliable typed foundation.

    Feature: Builder initialization
      Scenario: Builder starts on its dedicated port
        Given dependencies are installed
        When I run "make dev" or "npm run dev" with port 3001
        Then the builder is available at "http://localhost:3001"
        And generated previews do not bind port 3001

      Scenario: TypeScript strict mode is enabled
        When I run "npm run typecheck"
        Then strict TypeScript validation is the project gate

### Tasks

- [x] T-1.1.1: Next.js App Router + TypeScript + Tailwind
- [x] T-1.1.2: Strict TypeScript
- [x] T-1.1.3: `@/*` path alias
- [x] T-1.1.4: Builder port 3001 (Makefile `PORT`)
- [x] T-1.1.5: Root error/loading boundaries
- [x] T-1.1.6: `lint`, `typecheck`, `test`, `test:e2e` scripts

## US-1.2: Install the Builder UI Stack [x]

As a developer I want a standard UI and state stack so chat, split panes, and dialogs are consistent.

    Feature: Builder dependencies
      Scenario: Required packages are importable
        Then shadcn-style UI primitives work
        And `@ai-sdk/react` / `ai` chat hooks work
        And Zod schemas validate domain/theme/selection payloads
        And resizable panels and toasts are available

### Tasks

- [x] T-1.2.1: shadcn/ui-style components under `components/ui/`
- [x] T-1.2.2: `ai` + `@ai-sdk/react`
- [x] T-1.2.3: Zod
- [x] T-1.2.4: `react-resizable-panels`
- [x] T-1.2.5: Zustand builder UI store
- [x] T-1.2.6: Sonner toaster + dialog primitives

## US-1.3: Configure the Builder Directory Structure [x]

As a developer I want domain modules separated so Hermes, runtime, projects, preview, and chat stay coherent.

### Tasks

- [x] T-1.3.1: `app/projects/**`, `app/templates/**`
- [x] T-1.3.2: `components/builder/`
- [x] T-1.3.3: `lib/hermes/`
- [x] T-1.3.4: `lib/runtime/`
- [x] T-1.3.5: `lib/projects/`
- [x] T-1.3.6: `lib/themes/`
- [x] T-1.3.7: `lib/visual-selector/`
- [x] T-1.3.8: `lib/security/`
- [x] T-1.3.9: `lib/chat/`, `lib/db/`

## US-1.4: Configure Persistence [x]

As a developer I want persistent project and chat metadata so work survives builder restarts.

    Feature: Local persistence
      Scenario: Builder restarts without losing projects
        Given projects exist in SQLite under `.apploop/`
        When the builder restarts
        Then projects remain listed with workspace, theme, and conversation association

### Tasks

- [x] T-1.4.1: Drizzle ORM
- [x] T-1.4.2: SQLite local DB (libsql/drizzle)
- [x] T-1.4.3: Tables for projects, conversations, messages, runs, runtimes, themes, settings, templates, checkpoints, screenshots, etc.
- [x] T-1.4.4: Migrations via `npm run db:migrate`
- [x] T-1.4.5: Repository abstractions (`lib/db/repository.ts`, `lib/projects/repository.ts`)

## US-1.5: Configure Environment Variables [x]

As a developer I want validated environment configuration so invalid setup fails server-side.

### Tasks

- [x] T-1.5.1: Server env helpers under `lib/env/`
- [x] T-1.5.2: Hermes base URL / keys server-only
- [x] T-1.5.3: `PROJECTS_ROOT`
- [x] T-1.5.4: Preview port range
- [x] T-1.5.5: Database URL
- [x] T-1.5.6: `.env-example` guidance

---

# E2: Project Management

## US-2.1: Create a Project [x]

As a user I want to create a project so I get a separate editable Next.js application.

Uses `/theme-system`

    Feature: Project creation
      Scenario: Create from a selected template via full page
        Given I open "/projects/new"
        When I submit name, templateId, and themeId
        Then a project bundle is written to SQLite
        And a workspace is copied under PROJECTS_ROOT
        And theme tokens are applied when required
        And git is initialized in the workspace
        And I am redirected to "/projects/{id}"
        And Hermes is not invoked during create

### Tasks

- [x] T-2.1.1: Full-page create project UI (`/projects/new`)
- [x] T-2.1.2: Slug + unique workspace path
- [x] T-2.1.3: Template copy via `createProjectWorkspace`
- [x] T-2.1.4: Project bundle (project/conversation/runtime/theme/settings)
- [x] T-2.1.5: Port allocation
- [x] T-2.1.6: `createProjectAction` redirect

## US-2.2: List and Open Projects [x]

As a user I want to list and open projects so chat and preview bind to the correct app.

### Tasks

- [x] T-2.2.1: `/projects` inventory with pagination
- [x] T-2.2.2: Open project action → builder
- [x] T-2.2.3: Remember last opened project
- [x] T-2.2.4: Runtime badge/status display

## US-2.3: Rename, Duplicate, Archive, Delete [x]

As a user I want lifecycle controls so inventory stays manageable.

### Tasks

- [x] T-2.3.1: Rename
- [x] T-2.3.2: Duplicate (DB + FS)
- [x] T-2.3.3: Archive / restore
- [x] T-2.3.4: Delete with name confirmation + trash move when applicable

## US-2.4: Project Settings [x]

As a user I want per-project settings so install policy, validation depth, route, and theme can change.

Uses `/theme-system`

### Tasks

- [x] T-2.4.1: Settings schema + action
- [x] T-2.4.2: Theme update + apply to workspace globals
- [x] T-2.4.3: packageInstallPolicy / validationDepth / autoStartPreview / defaultRoute

## US-2.5: Seed Demo Projects [x]

As a developer I want one demo project per built-in template after reset.

### Tasks

- [x] T-2.5.1: `scripts/seed-projects.mts`
- [x] T-2.5.2: Makefile `apploop-seed` / `seed` targets

## US-2.6: Multi-template Create Selection [x]

As a user I want to pick among shipped templates (default, admin, CV, research, rings, solar system, plus ready custom templates).

### Tasks

- [x] T-2.6.1: Built-in registry in `lib/projects/templates.ts`
- [x] T-2.6.2: Union with ready custom templates at create time

---

# E3: Generated Project Runtime

## US-3.1: Allocate Preview Ports [x]

Uses `/project-runtime`

### Tasks

- [x] T-3.1.1: Port range configuration
- [x] T-3.1.2: Unique allocation against projects/runtimes

## US-3.2: Start / Stop / Restart Preview Process [x]

Uses `/project-runtime`

    Feature: Runtime lifecycle
      Scenario: Start preview
        Given a project workspace exists
        When start runtime is requested
        Then a Next.js dev server starts on the allocated port
        And runtime status becomes starting/running
        And logs are captured

### Tasks

- [x] T-3.2.1: start/stop/restart server actions
- [x] T-3.2.2: PID/status/previewUrl persistence
- [x] T-3.2.3: Log file capture under `.apploop/runtime-logs/`

## US-3.3: Runtime Logs Surface [x]

### Tasks

- [x] T-3.3.1: Log polling API
- [x] T-3.3.2: Collapsible logs in builder

## US-3.4: Health / Failure Visibility [x]

### Tasks

- [x] T-3.4.1: Runtime status copy in preview chrome
- [x] T-3.4.2: Failure/loading overlays (dark preview loading)

## US-3.5: Dependency Install Policy Gate [x]

### Tasks

- [x] T-3.5.1: packageInstallPolicy stored per project and forwarded in agent context

## US-3.6: Makefile Runtime Ops Helpers [x]

### Tasks

- [x] T-3.6.1: `make dev` port reclaim
- [x] T-3.6.2: `make seed` / reset hygiene for workspaces

---

# E4: Hermes Backend & Streaming Chat

## US-4.1: Server-side Hermes Client [x]

Uses `/hermes-gateway`

### Tasks

- [x] T-4.1.1: `lib/hermes/client.ts` REST stream + run once + cancel
- [x] T-4.1.2: Auth headers server-only
- [x] T-4.1.3: User-safe error mapping

## US-4.2: Builder Chat Transport [x]

    Feature: Streaming chat
      Scenario: User sends a prompt
        Given a project is open
        When the user submits a prompt
        Then POST /api/chat streams AI SDK UI chunks
        And a user message and run are persisted
        And assistant text streams into the transcript

### Tasks

- [x] T-4.2.1: `useChat({ id: projectId })` + DefaultChatTransport `/api/chat`
- [x] T-4.2.2: Busy / stop / cancel controls
- [x] T-4.2.3: Activity cards from Hermes activity events

## US-4.3: Session Continuity [x]

### Tasks

- [x] T-4.3.1: Reserve Hermes session id at project create
- [x] T-4.3.2: Update session ids from gateway session events

## US-4.4: Image Attachments on Chat [x]

### Tasks

- [x] T-4.4.1: Clipboard paste screenshot attach path
- [x] T-4.4.2: Optional screenshot APIs under `/api/projects/[id]/screenshots`
- [x] T-4.4.3: Forward images to Hermes when present

## US-4.5: Composed Prompt Metadata [x]

### Tasks

- [x] T-4.5.1: Raw vs composed prompt extraction
- [x] T-4.5.2: Persist visualSelectionJson / screenshot ids on messages

## US-4.6: Run Cancellation [x]

### Tasks

- [x] T-4.6.1: In-memory active run map
- [x] T-4.6.2: `POST /api/chat/cancel` + gateway cancel

---

# E5: Hermes Agent Architecture

## US-5.1: Orchestrator + Specialists [x]

### Tasks

- [x] T-5.1.1: `.hermes/agents/project-builder.md`
- [x] T-5.1.2: ui-architect, nextjs-implementer, validation-repair, security-auditor
- [x] T-5.1.3: `createProjectAgentBundle()` assembly

## US-5.2: Project Context On Every Run [x]

### Tasks

- [x] T-5.2.1: workspacePath, theme, policies, defaultRoute
- [x] T-5.2.2: completionCriteria list
- [x] T-5.2.3: isolationRules for project vs template modes

## US-5.3: Mode Switching [x]

### Tasks

- [x] T-5.3.1: `project-edit`
- [x] T-5.3.2: `template-edit`
- [x] T-5.3.3: `template-authoring`

## US-5.4: Layout Validation Script Contract [x]

### Tasks

- [x] T-5.4.1: `npm run hermes:validate` entry for bundle

## US-5.5: Gateway Instructions Embed Bundle [x]

Uses `/hermes-gateway`

### Tasks

- [x] T-5.5.1: Instructions include isolation + context
- [x] T-5.5.2: agentBundle on stream/run payloads

---

# E6: Hermes Skills & Bundles

## US-6.1: UI Builder Bundle [x]

### Tasks

- [x] T-6.1.1: `.hermes/bundles/ui-builder/BUNDLE.md`
- [x] T-6.1.2: Activation order documented and coded

## US-6.2: Required Skills Set [x]

### Tasks

- [x] T-6.2.1: security-review
- [x] T-6.2.2: hermes-gateway
- [x] T-6.2.3: visual-selector
- [x] T-6.2.4: theme-system
- [x] T-6.2.5: frontend-design
- [x] T-6.2.6: generated-app-standards
- [x] T-6.2.7: project-runtime

## US-6.3: Skill Registry in TypeScript [x]

### Tasks

- [x] T-6.3.1: `lib/hermes/skills.ts` paths + capabilities

## US-6.4: Only UI Builder Skills Auto-Forwarded [x]

### Tasks

- [x] T-6.4.1: Desktop/general skills under `.hermes/skills/*` not auto-bundled unless listed

## US-6.5: Bundle Path References Remain Repo-Local [x]

### Tasks

- [x] T-6.5.1: Paths like `.hermes/skills/.../SKILL.md` in payload definitions

## US-6.6: Makefile HERMES_HOME Points at Repo [x]

### Tasks

- [x] T-6.6.1: `make hermes-gateway` uses `HERMES_HOME=$(PROJECT_ROOT)/.hermes`

---

# E7: Hermes Hooks & Commands

## US-7.1: Scope Guard Hook [x]

Uses `/security-review`

### Tasks

- [x] T-7.1.1: project-scope-guard pre-tool-use

## US-7.2: Generated Code Review Hook [x]

Uses `/generated-app-standards`

### Tasks

- [x] T-7.2.1: generated-code-review post-edit

## US-7.3: Theme Integrity Hook [x]

Uses `/theme-system`

### Tasks

- [x] T-7.3.1: theme-integrity post-edit

## US-7.4: Preview Readiness Hook [x]

Uses `/project-runtime`

### Tasks

- [x] T-7.4.1: preview-readiness before-completion

## US-7.5: Command Recipes [x]

### Tasks

- [x] T-7.5.1: project-build / fix / preview / theme / element-edit / validate / snapshot
- [x] T-7.5.2: `lib/hermes/commands.ts` registry

## US-7.6: Commands Included in Agent Bundle [x]

### Tasks

- [x] T-7.6.1: UI_BUILDER_COMMANDS attached on every project bundle

---

# E8: Live Preview Browser

## US-8.1: Browser-like Preview Frame [x]

### Tasks

- [x] T-8.1.1: iframe with sandbox + src builder
- [x] T-8.1.2: loading / failed / not-ready dark surfaces

## US-8.2: Route Controls [x]

### Tasks

- [x] T-8.2.1: route input + history back/forward
- [x] T-8.2.2: defaultRoute from settings

## US-8.3: Viewport Presets [x]

### Tasks

- [x] T-8.3.1: desktop/tablet/phone viewport modes
- [x] T-8.3.2: localStorage persistence per project

## US-8.4: Trusted Preview Messaging [x]

Uses `/security-review`

### Tasks

- [x] T-8.4.1: origin + projectId + previewNonce checks
- [x] T-8.4.2: nonce rotation on reload

## US-8.5: Preview Reload After Agent Edits [x]

### Tasks

- [x] T-8.5.1: reloadKey / cache bust patterns after chat completion paths
- [x] T-8.5.2: restart runtime action available after restore

---

# E9: Visual Element Selection

## US-9.1: Inspect Mode Toggle [x]

Uses `/visual-selector`

### Tasks

- [x] T-9.1.1: Builder inspect button
- [x] T-9.1.2: postMessage enable/disable into iframe

## US-9.2: Hover Highlight [x]

### Tasks

- [x] T-9.2.1: iframe hover payload
- [x] T-9.2.2: parent hover overlay state

## US-9.3: Click Select / Multi-select [x]

    Feature: Target selection
      Scenario: Select by last classname
        Given inspect mode is on
        When the user clicks an element whose last classname is "vestaboard-title"
        Then preferredSelector is ".vestaboard-title"
        And the Targets list shows that selection

### Tasks

- [x] T-9.3.1: toggleSelectedElement by preferredSelector
- [x] T-9.3.2: multi-select map + clear/remove
- [x] T-9.3.3: scroll tracking updates rects for all selected

## US-9.4: Selection Schema [x]

### Tasks

- [x] T-9.4.1: Zod visualSelectionSchema
- [x] T-9.4.2: ancestry, boundingRect (allow negative x/y), inspectorId optional

## US-9.5: Compose Prompt With Boundaries [x]

### Tasks

- [x] T-9.5.1: `createVisualSelectionPrompt`
- [x] T-9.5.2: JSON target payload appended for Hermes

## US-9.6: Template Inspector Providers [x]

### Tasks

- [x] T-9.6.1: inspector-provider in shipped templates
- [x] T-9.6.2: keyboard next/prev target shortcuts where implemented

## US-9.7: No Auto-Screenshot on Select [x]

### Tasks

- [x] T-9.7.1: selection does not force screenshot capture
- [x] T-9.7.2: clipboard image attach remains explicit paste path

---

# E10: shadcn/Luma Theme System

## US-10.1: Built-in Theme Registry [x]

Uses `/theme-system`

### Tasks

- [x] T-10.1.1: `lib/themes/registry.ts` built-ins
- [x] T-10.1.2: light/dark required tokens

## US-10.2: Apply Theme To Workspace [x]

### Tasks

- [x] T-10.2.1: `applyThemeToWorkspace`
- [x] T-10.2.2: preserve template-specific non-token CSS where designed

## US-10.3: Custom Theme CSS Parsing [x]

### Tasks

- [x] T-10.3.1: parse `:root` / `.dark` only
- [x] T-10.3.2: block imports/urls
- [x] T-10.3.3: ignore allowlisted extras (e.g. `--destructive-foreground`, `--board`)
- [x] T-10.3.4: reject unknown tokens

## US-10.4: Theme On Create Project [x]

### Tasks

- [x] T-10.4.1: theme radio cards on `/projects/new`
- [x] T-10.4.2: template default theme badges

## US-10.5: Theme On Template Create [x]

### Tasks

- [x] T-10.5.1: editable theme CSS textarea validated before Hermes

## US-10.6: Builder Theme Toggle [x]

### Tasks

- [x] T-10.6.1: builder chrome theme provider support

---

# E11: Generated App Code Standards

## US-11.1: Standards Skill + Enforcement Expectations [x]

Uses `/generated-app-standards`

### Tasks

- [x] T-11.1.1: skill content under `.hermes/skills/generated-app-standards/`
- [x] T-11.1.2: hook checks for classnames/export/route conventions

## US-11.2: Unique Last Classname Rule [x]

### Tasks

- [x] T-11.2.1: documented + inspired prompt/guardrails
- [x] T-11.2.2: preferredSelector = last classname contract

## US-11.3: Template Body Classname Identity [x]

### Tasks

- [x] T-11.3.1: `template-<id>` required on body
- [x] T-11.3.2: stamp on custom template create

## US-11.4: Provider Compatibility [x]

### Tasks

- [x] T-11.4.1: inspector-provider + theme-provider required for templates

## US-11.5: Formatting / Export Conventions [x]

### Tasks

- [x] T-11.5.1: skill documents TS style + named export patterns for generated apps

---

# E12: File Generation & Editing

## US-12.1: Hermes Edits Only Workspace Root [x]

Uses `/security-review`

### Tasks

- [x] T-12.1.1: isolation rules in agent bundle
- [x] T-12.1.2: scope-guard hook metadata

## US-12.2: Boundary-Limited Element Edits [x]

Uses `/visual-selector`

### Tasks

- [x] T-12.2.1: composed prompt constraints
- [x] T-12.2.2: `/project-element-edit` command recipe

## US-12.3: Template Copy On Project Create [x]

### Tasks

- [x] T-12.3.1: recursive copy without node_modules/.next
- [x] T-12.3.2: git init per workspace

## US-12.4: Activity Events For File Changes [x]

### Tasks

- [x] T-12.4.1: stream activity kinds into UI cards

## US-12.5: Template Authoring File Generation [x]

### Tasks

- [x] T-12.5.1: base template clone into `templates/<newId>`
- [x] T-12.5.2: Hermes once-run mutates that template tree

---

# E13: Validation & Repair Loop

## US-13.1: Validation Depth Setting [x]

### Tasks

- [x] T-13.1.1: quick/standard/deep stored and forwarded

## US-13.2: Validation Specialist Agent [x]

### Tasks

- [x] T-13.2.1: validation-repair agent in bundle

## US-13.3: Commands For Validate/Fix [x]

### Tasks

- [x] T-13.3.1: `/project-validate`, `/project-fix`

## US-13.4: Builder Check Scripts [x]

### Tasks

- [x] T-13.4.1: lint/typecheck/test available for builder
- [x] T-13.4.2: focused Vitest domain slices

## US-13.5: Bounded Repair Principle [x]

### Tasks

- [x] T-13.5.1: completion criteria require bounded failure reporting

---

# E14: Persistence, Checkpoints & Recovery

## US-14.1: SQLite Project Bundle Durability [x]

### Tasks

- [x] T-14.1.1: projects/conversations/runtimes/themes/settings inserts

## US-14.2: Chat Message Durability [x]

### Tasks

- [x] T-14.2.1: user/assistant message rows on chat
- [x] T-14.2.2: runs lifecycle rows

## US-14.3: Pre-prompt Git Checkpoints [x]

    Feature: Checkpoint before send
      Scenario: Snapshot files before Hermes mutates
        Given a project workspace with git
        When the user sends a prompt
        Then createFileSnapshot commits workspace state
        And a UI checkpoint stores prior message ids + commit hash

### Tasks

- [x] T-14.3.1: `createFileSnapshot`
- [x] T-14.3.2: client checkpoint save on send

## US-14.4: Restore Prompt [x]

### Tasks

- [x] T-14.4.1: findCheckpointBeforeMessage
- [x] T-14.4.2: git hard reset via revertToFileSnapshot
- [x] T-14.4.3: truncate UI messages before clicked prompt
- [x] T-14.4.4: delete DB messages from clicked id forward
- [x] T-14.4.5: restart runtime + reload preview

## US-14.5: Edit Prompt (Restore + Prefill) [x]

### Tasks

- [x] T-14.5.1: same rewind as restore
- [x] T-14.5.2: prefill short prompt text into composer

## US-14.6: Session History Boundaries [x]

### Tasks

- [x] T-14.6.1: session-history UI component
- [x] T-14.6.2: session boundary checkpoint support in store

## US-14.7: Snapshots / Recovery Helpers [x]

### Tasks

- [x] T-14.7.1: project snapshot tables/helpers exist for recovery flows
- [x] T-14.7.2: diagnostics export endpoint

---

# E15: Security & Isolation

## US-15.1: Path Containment [x]

Uses `/security-review`

### Tasks

- [x] T-15.1.1: `lib/security/paths.ts` assertInsideRoot
- [x] T-15.1.2: used by workspace/template operations

## US-15.2: Command Allow-list Patterns [x]

### Tasks

- [x] T-15.2.1: `lib/security/commands.ts` helpers for runtime commands

## US-15.3: Project Access Checks [x]

### Tasks

- [x] T-15.3.1: `requireProjectAccess` on chat and message actions

## US-15.4: Secret Non-exposure [x]

### Tasks

- [x] T-15.4.1: no Hermes/provider keys in client bundles
- [x] T-15.4.2: documented in AGENTS/SOUL/README

## US-15.5: Iframe Message Authentication [x]

### Tasks

- [x] T-15.5.1: origin + nonce + projectId

## US-15.6: Untrusted Browser Inputs [x]

### Tasks

- [x] T-15.6.1: ports/paths/session ids treated as untrusted

## US-15.7: Custom Theme Safety [x]

### Tasks

- [x] T-15.7.1: no remote imports/urls in theme CSS
- [x] T-15.7.2: size and selector restrictions

---

# E16: UX, Accessibility & Responsiveness

## US-16.1: Resizable Builder Shell [x]

Uses `/frontend-design`

### Tasks

- [x] T-16.1.1: chat/preview split panels
- [x] T-16.1.2: layout persistence hooks

## US-16.2: Full-page Create Flows [x]

### Tasks

- [x] T-16.2.1: `/projects/new` Luma create shell
- [x] T-16.2.2: `/templates/new` Luma create shell
- [x] T-16.2.3: listings pointed at routes (no create modals)

## US-16.3: Pending Overlays For Long Actions [x]

### Tasks

- [x] T-16.3.1: create project overlay
- [x] T-16.3.2: create template Hermes wait overlay

## US-16.4: Accessible Controls [x]

### Tasks

- [x] T-16.4.1: labeled inspect/send/stop controls
- [x] T-16.4.2: sr-only text where icon-only

## US-16.5: Responsive Create/List Layouts [x]

### Tasks

- [x] T-16.5.1: responsive grids for template/theme cards
- [x] T-16.5.2: stacked actions on small screens in key flows

---

# E17: Testing & Observability

## US-17.1: Unit/Integration Vitest Suite [x]

### Tasks

- [x] T-17.1.1: theme-system tests
- [x] T-17.1.2: visual-selector tests
- [x] T-17.1.3: runtime/preview tests
- [x] T-17.1.4: security isolation tests
- [x] T-17.1.5: checkpoint-restore tests
- [x] T-17.1.6: project domain tests

## US-17.2: Playwright E2E Harness [x]

### Tasks

- [x] T-17.2.1: `npm run test:e2e` script present

## US-17.3: Structured Chat/Hermes Events [x]

### Tasks

- [x] T-17.3.1: observability event recording around chat runs

## US-17.4: Diagnostics Export [x]

### Tasks

- [x] T-17.4.1: `/api/diagnostics/export`

## US-17.5: Makefile Quality Gates [x]

### Tasks

- [x] T-17.5.1: `make check` lint+typecheck
- [x] T-17.5.2: hermes gateway curl test target

## US-17.6: Broad E2E Coverage Maturity [~]

### Tasks

- [x] T-17.6.1: Playwright configured
- [ ] T-17.6.2: Full critical-path E2E pack maintained continuously (expand as product hardens)

---

# E18: Template Authoring & Template Edit

## US-18.1: Templates Inventory Page [x]

    Feature: Templates listing
      Scenario: Browse templates
        Given built-in and custom templates exist
        When I open "/templates"
        Then I see paginated cards with edit/clone/delete affordances
        And New template is available at top

### Tasks

- [x] T-18.1.1: `/templates` page
- [x] T-18.1.2: pagination
- [x] T-18.1.3: New template CTA → `/templates/new`

## US-18.2: Create Custom Template [x]

    Feature: Template authoring
      Scenario: Author a reusable template
        Given I submit template name, prompt, and theme CSS
        When createCustomTemplateAction runs
        Then templates/<id> is created from a base template
        And Hermes template-authoring runs once
        And project_templates becomes ready
        And openTemplateForEditing creates a Template: project
        And I redirect into the builder

### Tasks

- [x] T-18.2.1: `/templates/new` form
- [x] T-18.2.2: theme CSS validation
- [x] T-18.2.3: Hermes runProjectOnce authoring
- [x] T-18.2.4: readiness assertions
- [x] T-18.2.5: redirect into template edit project

## US-18.3: Edit Template In Place [x]

### Tasks

- [x] T-18.3.1: `openTemplateForEditing` binds templates/<id>
- [x] T-18.3.2: chat mode `template-edit`
- [x] T-18.3.3: isolation rules prevent sibling template/builder edits

## US-18.4: Clone Template [x]

### Tasks

- [x] T-18.4.1: clone disk + DB custom template row

## US-18.5: Delete Custom Template [x]

### Tasks

- [x] T-18.5.1: delete DB row + template directory for custom only

## US-18.6: Built-in Template Catalog [x]

### Tasks

- [x] T-18.6.1: default, admin-luma, ai-engineer-cv, deep-research-paper, luminous-rings, solar-system, algovivo-creature
- [x] T-18.6.2: additional disk templates may exist without built-in registry entry until registered

---

# E19: Deployment & Remote Runtimes

> Not shipped. Local preview only.

## US-19.1: Publish Generated App [ ]

### Tasks

- [ ] T-19.1.1: Define publish provider abstraction
- [ ] T-19.1.2: One-click deploy from builder

## US-19.2: Remote Runtime Provider [ ]

### Tasks

- [ ] T-19.2.1: Daytona/Docker/Vercel Sandbox adapter decision
- [ ] T-19.2.2: Remote preview URL plumbing

## US-19.3: Multi-user Hosted Builder [ ]

### Tasks

- [ ] T-19.3.1: AuthN/AuthZ model
- [ ] T-19.3.2: Multi-tenant isolation beyond single-user local SQLite

## US-19.4: Hosted Postgres Mode [ ]

### Tasks

- [ ] T-19.4.1: Production DATABASE_URL topology
- [ ] T-19.4.2: Migration story for hosted

## US-19.5: Billing / Quotas [ ]

### Tasks

- [ ] T-19.5.1: Meter Hermes/agent usage
- [ ] T-19.5.2: Plan limits

---

# Implemented Runtime Topology

```text
.
├── app/
│   ├── api/chat/
│   ├── api/projects/[projectId]/
│   ├── projects/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [projectId]/page.tsx
│   └── templates/
│       ├── page.tsx
│       └── new/page.tsx
├── components/
│   ├── builder/                 # BuilderShell, PreviewFrame, checkpoints…
│   ├── projects/                # create shells/forms
│   └── ui/
├── lib/
│   ├── chat/
│   ├── db/
│   ├── hermes/
│   ├── projects/
│   ├── runtime/
│   ├── security/
│   ├── themes/
│   └── visual-selector/
├── templates/                   # source blueprints
├── .hermes/
│   ├── agents/
│   ├── bundles/ui-builder/
│   ├── skills/                  # includes ui-builder set
│   ├── hooks/
│   └── commands/
├── .apploop/                    # LOCAL ONLY
│   ├── builder.sqlite
│   ├── projects/
│   └── runtime-logs/
├── scripts/seed-projects.mts
├── Makefile
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── SOUL.md
└── SPECS.md                     # this file
```

---

# MVP Definition of Done (Shipped)

The local MVP is complete when a user can:

1. Open the builder at `http://localhost:3001`.
2. Reset/seed demos via `make seed`.
3. Create a project from `/projects/new` with template + theme.
4. Open `/projects/{id}` and start preview runtime.
5. See the generated app in the right iframe on a unique port.
6. Chat with Hermes through AI SDK streaming (`/api/chat`).
7. Observe assistant text and activity events progressively.
8. Enable inspect mode and select element boundaries.
9. Send a targeted prompt that includes preferredSelector metadata.
10. Have Hermes edit only the active workspace.
11. Hot-reload/reload preview to observe the change.
12. Restore or Edit a prior user prompt (git + chat truncation).
13. Create a custom template from `/templates/new` (Hermes authoring).
14. Edit that template in a Template: project binding `templates/<id>`.
15. Persist projects/messages across builder restarts (SQLite).
16. Keep secrets server-side and iframe messages nonce-authenticated.
17. Run lint/typecheck/tests for the builder.
18. Use multiple built-in templates (CV, admin, research, rings, solar, default).

Not required for local MVP:

- Hosted multi-tenant SaaS
- One-click cloud deploy
- Remote ephemeral runtimes

---

# Acceptance Scenarios (Cross-epic)

## Scenario: Create project is local-only

    Given the Hermes gateway is stopped
    When I create a project from "/projects/new"
    Then the project is created and the builder opens
    And only later chat requires the gateway

## Scenario: Create template requires gateway

    Given the Hermes gateway is running
    When I create a template from "/templates/new"
    Then Hermes template-authoring mutates templates/<id>
    And I land in a Template: edit project

## Scenario: Inspect edit uses last classname

    Given preview is running and inspect is enabled
    When I click an element ending with classname "vestaboard-title"
    And I prompt "replace by: Josoroma" and send
    Then the composed prompt includes preferredSelector ".vestaboard-title"
    And Hermes is instructed to stay within that boundary

## Scenario: Restore rewinds files and chat

    Given a user message has a pre-prompt git checkpoint
    When I confirm Restore on that message
    Then workspace files reset to the checkpoint commit
    And that prompt and later messages are removed from UI and DB
    And preview restarts/reloads

---

# Environment Variables (Implemented families)

```bash
# Builder / data
DATABASE_URL=file:.apploop/builder.sqlite
PROJECTS_ROOT=.apploop/projects
PREVIEW_PORT_START=3100
PREVIEW_PORT_END=3199

# Hermes gateway (server-only)
HERMES_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=...
API_SERVER_KEY=...
HERMES_MODEL=...
HERMES_INFERENCE_MODEL=...
HERMES_INFERENCE_PROVIDER=...

# Optional providers
OPENROUTER_API_KEY=...
TAVILY_API_KEY=...
```

Exact names are resolved through `lib/env` + Makefile Hermes targets; never expose keys to the browser.

---

# Open Decisions (Current)

1. Whether additional disk templates (`vestaboard`, `lumacv`, …) should be promoted into `BUILT_IN_PROJECT_TEMPLATES` + seed.
2. How aggressively to expand Playwright critical-path coverage (E17.6).
3. Hosted runtime provider choice remains deferred (E19).
4. Whether custom themes become a first-class shareable gallery beyond project token JSON.
5. Whether session-boundary checkpoints should be fully server-canonical vs client-assisted.
6. Whether package installs during agent runs should harden further UX beyond policy enum.

---

# Document Control

| Field | Value |
| --- | --- |
| Product | AppLoop |
| Spec format | Epic → User Story → Gherkin scenarios → Tasks |
| Implementation status | Local MVP essentially complete; deploy epic open |
| Code/docs authorities | This file + `README.md` + `AGENTS.md` + deep links in `docs/` |
| Last reviewed against | Current AppLoop monorepo layout, create page routes, template authoring, inspect chat, restore/edit, Makefile seed |
