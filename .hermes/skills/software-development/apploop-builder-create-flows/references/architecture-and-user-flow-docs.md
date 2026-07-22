# AppLoop architecture & user-flow documentation set

Authoritative engineer docs (open `.html` in a browser):

| Doc | Audience | Contents |
|-----|----------|----------|
| `SPECS.md` (repo root) | Spec / acceptance | Epic → user story → Gherkin → tasks for **what ships now**. Same format as historical `docs/SPECS.md`. Use when debating done/not-done. See also [`specs-root-format.md`](specs-root-format.md). |
| `README.md` | Humans / PH | Onboarding, Product Hunt + YouTube demos, TOC, architecture sketch, seed/run |
| `AGENTS.md` / `CLAUDE.md` / `SOUL.md` | Agents | Operating contract aligned with page routes / seed / Hermes modes |
| `docs/README-ARCHITECTURE-DOCUMENTATION.html` | Architecture | UI planes, SQLite groups, server actions vs route handlers, Hermes stream mapping, trust zones — Luma dark + diagrams |
| `docs/README-HERMES.html` | Architecture / Hermes | `.apploop` tree + `.hermes/{agents,bundles,skills,hooks,commands}` + UI→gateway matrix |
| `docs/README-RESET.html` | Ops | Makefile run/reset/seed recipes, target ladder, catalog gap, verification |
| `docs/README-USER-FLOW-PROJECTS.md` | Product flow | Create project page path; local-only wait; DB/API/files; TOC |
| `docs/README-USER-FLOW-TEMPLATES.md` | Product flow | Create template page path; Hermes authoring wait; openTemplateForEditing redirect; DB/API/files; TOC |
| `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md` | Product flow | Inspect → send → response surfaces; Restore/Edit; DB/API/files; TOC |

## Authority order

1. Live code
2. Root `SPECS.md`
3. Flow + architecture HTML pack
4. Older planning notes / truncated historical SPECS

## Conventions when extending these docs

1. Put a **TOC** at the top of long flow docs.
2. Always cover for primary flows: **actions/APIs**, **DB tables (query vs mutate)**, **main implementing files**, plus sequence/compound diagrams when multi-hop.
3. Call out create-project latency vs create-template (local clone vs gateway `runProjectOnce`).
4. Architecture HTML docs should use **shadcn/Luma dark** tokens (`oklch` indigo primary) and self-contained CSS (no build step).
5. Prefer page routes for create flows (`/projects/new`, `/templates/new`) in all diagrams and checklists.
6. Docs-only verification: `git diff --check -- <files>` — fix trailing whitespace (avoid Markdown hard-break double spaces).
7. KPI overflow recipe: [`docs-html-kpi-overflow.md`](docs-html-kpi-overflow.md).

## Hermes UI call matrix (copy into architecture docs when needed)

| Builder action | AppLoop entry | Gateway? | Mode |
|----------------|---------------|----------|------|
| Inspect + Send / freeform chat | `POST /api/chat` | `streamProjectRun` | `project-edit` / `template-edit` |
| Create Template | `createCustomTemplateAction` | `runProjectOnce` | `template-authoring` |
| Create Project | `createProjectAction` | **No** | — |
| Restore / Edit | git + message delete + runtime restart | **No** | — |
| Preview start/stop | runtime actions | **No** | — |

Only the ui-builder seven skills are auto-forwarded via `createProjectAgentBundle`.