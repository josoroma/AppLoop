# Create latency + documentation map

Companion to `references/user-flow-docs.md`.

## Latency (user-visible)

| Flow | Overlay wait | Hermes during create? | Redirect |
|------|--------------|----------------------|----------|
| Create project `/projects/new` | short | **No** — local DB + fs copy + theme/git | `/projects/:id` |
| Create template `/templates/new` | long | **Yes** — `runProjectOnce` authoring | `/projects/:id` after `openTemplateForEditing` |

Never document create-project as a gateway conversation. Hermes starts on later chat.

## CTAs

- `/templates`: New template primary on top → `/templates/new`
- `/projects`: New project → `/projects/new`; Templates outline link

## Docs to keep in sync

- `docs/README-USER-FLOW-TEMPLATES.md`
- `docs/README-USER-FLOW-PROJECTS.md`
- `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`

Required sections: TOC, wait path, success landing, actions/APIs, DB tables, implementing files.