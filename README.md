# AppLoop

<a href="https://www.producthunt.com/products/apploop-2?launch=apploop-2" target="_blank" rel="noopener noreferrer"><img alt="AppLoop - Visually build apps with local AI Hermes Loop | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1200850&theme=light"></a>

**Local-first visual builder for generated Next.js apps.**
Chat with Hermes on the left. Drive a real running preview on the right. Point at elements, name the change, and land edits on the exact target.

## Table of contents

1. [See it live](#see-it-live)
2. [What AppLoop is](#what-apploop-is)
3. [Architecture at a glance](#architecture-at-a-glance)
4. [Quick start](#quick-start)
5. [Day-to-day workflows](#day-to-day-workflows)
6. [Repository map](#repository-map)
7. [Templates](#templates)
8. [Local state (`.apploop`)](#local-state-apploop)
9. [Hermes assets (`.hermes`)](#hermes-assets-hermes)
10. [API surface](#api-surface)
11. [Commands](#commands)
12. [Environment](#environment)
13. [Docs index](#docs-index)
14. [Development notes](#development-notes)

---

## See it live

Start with the Product Hunt launch page and the walkthrough videos:

| | Link |
| --- | --- |
| **Product Hunt** | [apploop-2 on Product Hunt](https://www.producthunt.com/products/apploop-2?launch=apploop-2) |
| **Video** | [YouTube · jPHKrebwvyA](https://www.youtube.com/watch?v=jPHKrebwvyA) |
| **Video** | [YouTube · RIXMJz4d5Es](https://www.youtube.com/watch?v=RIXMJz4d5Es) |
| **Video** | [YouTube · eZhgSQLvL6c](https://www.youtube.com/watch?v=eZhgSQLvL6c) |
| **Video** | [YouTube · kwJOute_Ej0](https://www.youtube.com/watch?v=kwJOute_Ej0) |

> Prefer watching once before reading the rest of this README if you are new to the product.

---

## What AppLoop is

AppLoop is **not** a cloud multiplayer IDE. It is a **laptop-native control plane**:

| Plane | What runs | Default |
| --- | --- | --- |
| Builder UI | Next.js App Router | `http://localhost:3001` |
| Generated previews | Independent `next dev` per project | `http://127.0.0.1:3100–3199` |
| AI gateway | Local Hermes with `HERMES_HOME=.hermes` | `http://127.0.0.1:8642` |
| Product DB | SQLite via Drizzle | `.apploop/builder.sqlite` |
| Workspaces | Real filesystem trees + per-project git | `.apploop/projects/<slug>` |

**AppLoop owns** projects, templates inventory, preview processes, theme application, chat durability, and security boundaries.
**Hermes owns** generative edits inside a path-contained workspace, guided by the repo-local agent bundle AppLoop ships on every run.

---

## Architecture at a glance

```text
┌──────────────────────┐     RSC / Server Actions / SSE      ┌──────────────────────────────┐
│  Browser             │ ──────────────────────────────────► │  AppLoop Next.js (:3001)     │
│  BuilderShell        │                                     │  routes · actions · /api     │
│  Inspect · Chat      │ ◄────────────────────────────────── │  SQLite · runtime supervisor │
└─────────┬────────────┘                                     └─────────────┬────────────────┘
          │ iframe + nonce postMessage                                     │
          ▼                                                                │ agentBundle
┌──────────────────────┐                                                   ▼
│  Preview runtime     │                                     ┌────────────────────────────┐
│  generated Next app  │◄──── spawn/stop/logs ───────────────│  Hermes gateway (:8642)    │
│  inspector-provider  │                                     │  agents/skills/hooks/cmds  │
└──────────────────────┘                                     │  tools → workspace FS only │
                                                             └────────────────────────────┘
```

Deep dive with Luma-dark diagrams: [`docs/README-ARCHITECTURE-DOCUMENTATION.html`](docs/README-ARCHITECTURE-DOCUMENTATION.html).

---

## Quick start

Assumes Node, npm, and the `hermes` CLI are already available, and `.env` / `.hermes/.env` are configured.

```bash
# From repo root
make install                 # root deps (if needed)

# Clean local AppLoop state + install all template deps + migrate + seed demos
make seed

# Terminal A — AI gateway
make hermes-gateway

# Terminal B — builder
make dev
# → http://localhost:3001/projects
```

Optional gateway smoke test:

```bash
make hermes-gateway-curl-test
```

Full ops detail (what each Makefile target deletes/preserves): [`docs/README-RESET.html`](docs/README-RESET.html).

---

## Day-to-day workflows

### Create a project (local, no Hermes during create)

1. Open `/projects` → **New project** → `/projects/new`
2. Name + template + theme
3. Redirects to `/projects/<id>` builder after FS copy + DB bundle

Guide: [`docs/README-USER-FLOW-PROJECTS.md`](docs/README-USER-FLOW-PROJECTS.md)

### Create a template (Hermes authors first, then template-edit)

1. Open `/templates` → **New template** → `/templates/new`
2. Name, description, prompt, theme CSS
3. AppLoop stages `templates/<id>`, runs Hermes `template-authoring`, opens edit project, redirects to builder

Guide: [`docs/README-USER-FLOW-TEMPLATES.md`](docs/README-USER-FLOW-TEMPLATES.md)

### Inspect → targeted chat edit

1. Start preview on a project
2. **Inspect elements** → click a unique last classname (e.g. `.vestaboard-title`)
3. Prompt + Send → git checkpoint → `POST /api/chat` → Hermes stream
4. Use **Restore** / **Edit** on prior user messages to rewind conversation + files

Guide: [`docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`](docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md)

```text
Inspect (preferredSelector = LAST classname)
   → compose bounded prompt
   → createFileSnapshot (git)
   → POST /api/chat
   → Hermes streamProjectRun(agentBundle)
   → files change + assistant message + preview reload
```

---

## Repository map

```text
app/                     # Builder App Router (projects, templates, api)
components/
  builder/               # BuilderShell, PreviewFrame, checkpoints, session history
  projects/              # Create flow shell + project/template forms
  ui/                    # shadcn primitives
lib/
  projects/              # domain: create, templates, actions, files
  runtime/               # preview process lifecycle
  hermes/                # client, agent bundle, skills/hooks/commands registry
  themes/                # shadcn/Luma registry + apply
  visual-selector/       # selection schema + prompt composition
  chat/                  # messages, snapshots, restore helpers
  db/                    # drizzle schema + repository contracts
  security/              # path containment, command allow-list, authz
templates/               # source blueprints copied into projects
.hermes/                 # Hermes home — agents, bundles, skills, hooks, commands
.apploop/                # LOCAL ONLY — sqlite, projects, runtime-logs
docs/                    # architecture / flow / ops HTML+MD
scripts/                 # seed-projects.mts, hermes layout validation
```

Agent guidance lives in parallel:

- [`AGENTS.md`](AGENTS.md) — coding agent rules
- [`CLAUDE.md`](CLAUDE.md) — Claude/Claude Code session guide
- [`SOUL.md`](SOUL.md) — product principles

---

## Templates

Built-in templates registered in `lib/projects/templates.ts` (seeded as demo projects by `make seed`):

| id | Name | Default theme |
| --- | --- | --- |
| `default` | Default Next.js | `luma-blue-violet` |
| `admin-luma` | Luma Admin | `luma-admin-amber` |
| `ai-engineer-cv` | AI Engineer CV | `luma-cv-indigo` |
| `deep-research-paper` | Deep Research Paper | `luma-amber-slate` |
| `luminous-rings` | Luminous Rings | `luma-violet-cyan` |
| `solar-system` | Solar System Explorer | `luma-indigo-emerald` |
| `algovivo-creature` | Algovivo Soft Creature | `luma-orange-stone` |

Additional folders may exist under `templates/` (e.g. experimental or custom). `make seed` installs deps for every `templates/*/package.json`, but only **built-in registry** entries become demo projects automatically. Custom templates also appear after Create Template succeeds.

Every template cycle should preserve:

- standalone generated app shape (`package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`)
- `components/inspector-provider.tsx` + `components/theme-provider.tsx`
- body classname `template-<id>`
- inspectable classnames with a **unique last classname**

---

## Local state (`.apploop`)

```text
.apploop/
  builder.sqlite          # projects, conversations, messages, runs, runtimes, …
  projects/<slug>/        # full generated Next apps + .git checkpoints
  runtime-logs/<id>.log   # preview process logs
```

- Created/wiped by `make apploop-reset` / `make seed`
- **Never commit** this tree
- Template-edit projects may point `workspace_path` at `templates/<id>` while still recording chat in SQLite here

Details: [`docs/README-HERMES.html`](docs/README-HERMES.html)

---

## Hermes assets (`.hermes`)

AppLoop ships a product agent surface (committed) plus local gateway operational files (not committed).

| Path | Role |
| --- | --- |
| `.hermes/agents/` | Orchestrator + UI / implementer / validation / security personas |
| `.hermes/bundles/ui-builder/` | `/ui-builder` skill activation order |
| `.hermes/skills/` | UI builder skills (and other desktop skills unused by the default bundle) |
| `.hermes/hooks/` | Scope guard, code review, theme integrity, preview readiness |
| `.hermes/commands/` | Slash recipes (`project-element-edit`, `project-build`, …) |

Assembly happens in `lib/hermes/agents.ts` → `createProjectAgentBundle()` and is sent on:

- interactive chat: `POST /api/chat` → `HermesClient.streamProjectRun`
- template create: `createCustomTemplateAction` → `runProjectOnce`

```text
UI → AppLoop API/action → agentBundle{agents, bundle, skills, hooks, commands, isolation}
                        → Hermes gateway (HERMES_HOME=.hermes)
                        → tools mutate ONLY workspacePath
                        → stream events → SQLite + chat UI + preview
```

Details: [`docs/README-HERMES.html`](docs/README-HERMES.html)

---

## API surface

### Route handlers

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | AI SDK UI stream → Hermes; persists messages/runs |
| `POST /api/chat/cancel` | Cancel active run |
| `GET /api/projects/[id]/runtime/logs` | Preview log polling |
| `POST/GET /api/projects/[id]/screenshots` | Inspector/clipboard images |
| `GET /api/diagnostics/export` | Local diagnostics |

### Important server actions

| Action | Purpose |
| --- | --- |
| `createProjectAction` | Local scaffold + redirect builder |
| `createCustomTemplateAction` | Template authoring + Hermes once + template edit redirect |
| `editTemplateAction` | Open template workspace as edit project |
| `start/stop/restartRuntimeAction` | Preview lifecycle |
| `createFileSnapshot` / `revertToFileSnapshot` | Git checkpoints for Restore/Edit |
| `deleteProjectConversationMessagesFrom` | Durable chat truncation |

---

## Commands

```bash
# Quality
npm run lint
npm run typecheck
npm test
npm run test:e2e
make check

# App
npm run dev          # prefer: make dev  (port from Makefile)
npm run build
npm run start

# Data
npm run db:generate
npm run db:migrate

# Ops
make hermes-gateway
make hermes-gateway-curl-test
make seed
make apploop-reset
make apploop-seed
make reset
make help
```

Focused tests (examples):

```bash
npm test -- tests/visual-selector.test.ts
npm test -- tests/theme-system.test.ts
npm test -- tests/checkpoint-restore.test.ts
npm test -- tests/runtime*.test.ts
```

Docs-only:

```bash
git diff --check
```

---

## Environment

Copy `.env-example` → `.env`. Common knobs:

| Variable family | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path (default under `.apploop/`) |
| `PROJECTS_ROOT` | Generated workspaces root |
| `PREVIEW_PORT_START` / `END` | Preview allocation range |
| `HERMES_BASE_URL` | Gateway URL (local default `:8642`) |
| `HERMES_*` / OpenRouter model vars | Inference routing for Hermes |
| `API_SERVER_KEY` | Gateway auth (server only) |
| `OPENROUTER_API_KEY` | Provider (server only) |
| `TAVILY_API_KEY` | Optional search (server only) |

**Never** expose provider or gateway secrets to browser bundles.

Makefile Hermes targets set `HERMES_HOME` to the repo `.hermes/` directory and source `.hermes/.env` then `.env` when present.

---

## Docs index

| Doc | Contents |
| --- | --- |
| [`docs/README-ARCHITECTURE-DOCUMENTATION.html`](docs/README-ARCHITECTURE-DOCUMENTATION.html) | UI, DB, gateway, API communication (Luma dark) |
| [`docs/README-HERMES.html`](docs/README-HERMES.html) | `.apploop` + `.hermes` trees and bundle wiring |
| [`docs/README-RESET.html`](docs/README-RESET.html) | Makefile run / reset / seed recipes |
| [`docs/README-USER-FLOW-PROJECTS.md`](docs/README-USER-FLOW-PROJECTS.md) | Create project walkthrough |
| [`docs/README-USER-FLOW-TEMPLATES.md`](docs/README-USER-FLOW-TEMPLATES.md) | Create template walkthrough |
| [`docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`](docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md) | Inspect, chat, restore/edit |
| [`docs/SPECS.md`](docs/SPECS.md) | Historical product/planning spec — verify vs code |

---

## Development notes

- Create Project / Create Template are **pages**, not modals.
- Preview inspect selections rely on **unique last classnames**; multi-select keys off `preferredSelector`.
- Chat uses AI SDK `useChat` with `id = projectId` and transport `POST /api/chat`.
- Before each send, AppLoop takes a **git checkpoint** in the workspace so Restore can hard-reset files.
- External file writers (agents, builder ops) may need `CHOKIDAR_USEPOLLING=true` on template `dev` scripts and/or preview reload cache-busting after edits.
- Do not commit `.apploop/`, Hermes auth/log/cache/session dumps, or `.next/` trees.
- Prefer small diffs; match existing Zod/service patterns; keep secrets server-side.

---

## License / status

Private package (`apploop@0.1.0`). Local-first product under active development — treat this README and `AGENTS.md` as current contraction of the repo; open linked HTML docs for diagrams and run tables.
