# AppLoop architecture & user-flow documentation set

Authoritative engineer docs written this product cycle (open in browser where `.html`):

| Doc | Audience | Contents |
|-----|----------|----------|
| `docs/README-ARCHITECTURE-DOCUMENTATION.html` | Architecture | UI planes, SQLite groups, server actions vs route handlers, Hermes gateway stream mapping, security trust zones — Luma dark theme + diagrams |
| `docs/README-RESET.html` | Ops | Makefile run/reset/seed recipes, target ladder, catalog gap, verification |
| `docs/README-USER-FLOW-PROJECTS.md` | Product flow | Create project page path; local-only wait; DB/API/files; TOC |
| `docs/README-USER-FLOW-TEMPLATES.md` | Product flow | Create template page path; Hermes authoring wait; openTemplateForEditing redirect; DB/API/files; TOC |
| `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md` | Product flow | Inspect → send → hub response surfaces; Restore/Edit; DB/API/files; TOC |

## Conventions when extending these docs

1. Put a **TOC** at the top of long flow docs.
2. Always cover for primary flows: **actions/APIs**, **DB tables (query vs mutate)**, **main implementing files**, plus sequence/compound diagrams when multi-hop.
3. Call out create-project latency vs create-template (local clone vs gateway `runProjectOnce`).
4. Architecture HTML docs should use **shadcn/Luma dark** tokens (`oklch` indigo primary) and self-contained CSS (no build step).
5. Prefer page routes for create flows (`/projects/new`, `/templates/new`) in all diagrams and checklists.