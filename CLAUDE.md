# Claude Guidance For AppLoop

Use this file as project-specific guidance for Claude or Claude Code sessions working in AppLoop.

## Start Here

- Read `README.md` for setup, architecture sketch, docs index, Product Hunt / demo links.
- Read `AGENTS.md` for general coding-agent rules and validation slices.
- Keep root `SOUL.md` in mind for product principles and boundaries.
- Deep dives when needed:
  - Architecture UI/DB/gateway: `docs/README-ARCHITECTURE-DOCUMENTATION.html`
  - `.apploop` + `.hermes` assets: `docs/README-HERMES.html`
  - Reset/seed ops: `docs/README-RESET.html`
  - User flows: `docs/README-USER-FLOW-*.md`
  - Historical planning spec: `docs/SPECS.md` (verify against code before trusting)

## What This App Is

AppLoop is a local-first visual builder for generated Next.js apps.

- Builder: `localhost:3001`
- Previews: separate Next.js dev servers on `127.0.0.1:3100-3199` from `.apploop/projects/<slug>` (or `templates/<id>` for template-edit projects)
- Brain: local Hermes gateway (default `127.0.0.1:8642`) receiving AppLoop-assembled agent bundles

## Main User Workflows

### Create project (local, fast)

1. `/projects` → **New project** → `/projects/new`
2. Name + template + theme
3. Server action copies template → workspace, writes SQLite project bundle, redirects `/projects/[id]`
4. **No Hermes call during create**

### Create template (gateway-heavy)

1. `/templates` → **New template** → `/templates/new`
2. Name / description / prompt / theme CSS
3. Server action stages `templates/<id>`, runs Hermes `runProjectOnce` (`template-authoring`), then opens template edit project and redirects `/projects/[id]`

### Edit with inspect

1. Open builder for a project
2. Start preview runtime
3. **Inspect elements** → click target (preferredSelector = last classname)
4. Prompt + Send → git checkpoint + `POST /api/chat` → Hermes stream → assistant + files + preview
5. Optional **Restore** / **Edit** on prior user messages (git revert + truncate chat from that prompt)

## Common Development Tasks

- Builder UI: `components/builder/`
- Project/template dashboards and create pages: `app/projects/`, `app/templates/`, `components/projects/`
- Generated template sources: `templates/*/` (default, admin-luma, ai-engineer-cv, deep-research-paper, luminous-rings, solar-system, algovivo-creature, immersive-full-screen, vestaboard, lumacv, …)
- Visual inspector: often both `components/builder/preview-frame.tsx` and `templates/*/components/inspector-provider.tsx`
- Runtime lifecycle: `lib/runtime/`
- Hermes bridge: `lib/hermes/` + `.hermes/{agents,bundles,skills,hooks,commands}`
- Theme catalog/apply: `lib/themes/`
- Chat checkpoints / snapshots: `lib/chat/`

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
make hermes-gateway
make seed
make check
```

Use focused Vitest slices when possible. For docs-only changes:

```bash
git diff --check
```

## Environment

Copy `.env-example` to `.env` for local configuration. OpenRouter is configured through `OPENROUTER_API_KEY` and Hermes model/provider variables. Tavily is optional through `TAVILY_API_KEY`. Repo-local Hermes home is `.hermes/` (`HERMES_HOME` via Makefile). Gateway key stays server-side (`API_SERVER_KEY` / Hermes client config).

Do not print, commit, or move real secrets into browser-visible code.

## Editing Rules

- Do not revert unrelated user changes.
- Keep diffs small and local.
- Use existing services and schemas before adding new ones.
- Do not hand-roll process, path, or command safety when helpers already exist.
- Update active generated workspaces only when needed to validate a live preview issue; keep templates synchronized when the fix should apply to future projects.
- Create flows are page routes (`/projects/new`, `/templates/new`), not dialogs.
- Unique last classnames on generated/template UI are required for multi-select inspect.
- Do not add screenshots with arbitrary resizing unless explicitly requested.
- If a visual feature fails user acceptance 2+ times, stop iterating library swaps — offer removal or a fundamentally different approach.

## Validation Notes

- Use `npm run lint` and `npm run typecheck` for broad TypeScript/UI changes.
- Use Vitest slices for specific domains (`theme-system`, `visual-selector`, `runtime*`, `checkpoint-restore`, `project-*`).
- Use Playwright/browser checks for iframe, inspector, and runtime preview behavior.
- Runtime log streams can keep browser pages from reaching `networkidle`; prefer `domcontentloaded` plus a text or selector wait.
- After external file writes to a running preview workspace, remember Turbopack may need polling (`CHOKIDAR_USEPOLLING`) or a runtime restart / cache-bust `?_t=` reload — not only `touch`.
