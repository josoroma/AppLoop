# Agent Instructions For AppLoop

These instructions apply to coding agents working in this repository.

## Project Summary

AppLoop is a local-first Next.js visual app builder. The main builder runs on `http://localhost:3001`. Generated Next.js apps are copied from `templates/` into `.apploop/projects/<slug>` and run on preview ports in the `3100-3199` range.

Key surfaces:

- Builder pages: `app/projects/page.tsx`, `app/projects/new/page.tsx`, `app/projects/[projectId]/page.tsx`
- Template pages: `app/templates/page.tsx`, `app/templates/new/page.tsx`
- Presentation pages: `app/presentations/page.tsx`, `app/presentations/new/page.tsx`, `app/presentations/[presentationId]/page.tsx`
- Builder UI: `components/builder/`
- Presentation UI: `components/presentations/`
- Create flows: `components/projects/` (`create-flow-shell`, `project-create-form`, `template-create-form`) and `components/presentations/presentation-create-form.tsx`
- Project creation and files: `lib/projects/`
- Presentation creation and Marp render: `lib/presentations/`
- Presentation visual editing: `components/presentations/presentation-builder-shell.tsx`, `lib/presentations/inspect-editor-assets.ts`, `lib/presentations/inspect-styles.ts`, and `lib/presentations/marp-utils.ts`
- Runtime lifecycle: `lib/runtime/` (projects only — presentations do not use preview ports)
- Hermes integration: `lib/hermes/` and `.hermes/`
- Themes: `lib/themes/`
- Visual inspector: `lib/visual-selector/`, `components/builder/preview-frame.tsx`, and `templates/*/components/inspector-provider.tsx`
- Chat checkpoints / restore: `lib/chat/`, checkpoint restore in `components/builder/builder-shell.tsx`
- Persistence: `lib/db/`
- Security helpers: `lib/security/`

Deep docs (read when relevant):

- `docs/README-ARCHITECTURE-DOCUMENTATION.html`
- `docs/README-HERMES.html`
- `docs/README-RESET.html`
- `docs/README-USER-FLOW-PROJECTS.md`
- `docs/README-USER-FLOW-TEMPLATES.md`
- `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`
- `docs/README-USER-FLOW-PRESENTATIONS.md`

## Ownership Boundary

- **AppLoop owns** project/template/presentation records, SQLite, preview ports/PIDs (projects only), Marp HTML preview rendering, presentation inspect/edit persistence, path containment, theme validation, redirects, and agent-bundle assembly.
- **Hermes owns** generative workspace edits through the local gateway using the shipped `.hermes` agents/skills/hooks/commands.
- **Browser owns** inspect selection, composer UI, and stream consumption — never secrets or authoritative FS writes.

Do not blur that boundary.

## Commands

Use npm unless a task specifically involves Makefile helpers.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run db:generate
npm run db:migrate
```

Useful Makefile commands:

```bash
make help
make install
make dev
make check
make hermes-gateway
make hermes-gateway-curl-test
make seed                 # apploop-reset + migrate + template deps + demo projects/presentations
make apploop-reset
make apploop-seed
make apploop-seed-presentations
make reset                # also removes root node_modules
```

If the shell prompts to source `.env` during validation, answer `N` unless the task specifically requires local secrets.

## Local State And Generated Files

- Do not commit `.apploop/`, `.next/`, runtime logs, local SQLite databases, Hermes auth files, Hermes logs, Hermes cache, session dumps, or local gateway state.
- Generated project workspaces under `.apploop/projects/` may need temporary edits for live validation, but durable template changes should usually be made under `templates/` as well.
- Generated presentation workspaces under `.apploop/presentations/` are local Marp decks; `deck.md` is source of truth and presentations do not have preview ports/PIDs.
- Presentation templates under `presentations-templates/` are durable sources for future decks; active generated decks under `.apploop/presentations/` may need temporary live validation edits but should not replace template fixes when the behavior should apply to newly created decks.
- If the active generated workspace is relevant to a user-reported preview bug, patch the active `.apploop/projects/<slug>` copy and the source template when appropriate.
- Template-edit projects point `workspacePath` at `templates/<id>` (live template source), not a projects-root clone.

## Coding Guidelines

- Keep changes scoped to the requested behavior.
- Prefer existing local services, schemas, and helpers over new abstractions.
- Preserve strict TypeScript and existing component style.
- Use structured parsing and Zod schemas where the codebase already does.
- Keep UI text concise and functional.
- Avoid hard-coded generated app colors; use theme tokens from `lib/themes/registry.ts`.
- Keep visual selector payloads compatible with `lib/visual-selector/types.ts`.
- For inspectable UI, write shared/base classnames **plus a unique human-readable last classname** (preferredSelector is the last classname).
- Create project / create template are **full page routes**, not modals.
- Remember that `getBoundingClientRect()` can return negative `x` or `y` for scrolled elements.
- Never auto-screenshot on inspect; clipboard paste is screenshot-only when that feature is active.
- In presentation edit mode, SVG shapes/icons are first-class selectable elements. Select and persist the owning `<svg>` wrapper for movement, sizing, layer/delete, and reload stability; apply paint properties such as `fill`, `stroke`, and `strokeWidth` to the marked inner primitive with `data-apploop-shape`.
- Presentation element movement is free-positioning by default: dragging or arrow keys must not swap, reflow, resize, or delete other elements, and overlap is allowed.

## Validation Expectations

Choose the narrowest meaningful check after edits:

- Visual selector changes: `npm test -- tests/visual-selector.test.ts`
- Runtime changes: `npm test -- tests/runtime*.test.ts tests/preview-browser.test.ts`
- Presentation changes: `npm test -- tests/presentation-marp.test.ts tests/presentation-inspect-styles.test.ts`
- Theme changes: `npm test -- tests/theme-system.test.ts`
- Project domain changes: `npm test -- tests/project-*.test.ts`
- Checkpoint restore: `npm test -- tests/checkpoint-restore.test.ts`
- General TypeScript or UI changes: `npm run lint` and `npm run typecheck`
- Browser behavior: use Playwright against the running builder when available.

Always run `git diff --check` for documentation-only or screenshot-only changes.

## Hermes Assets

AppLoop sends a Hermes project agent bundle from `/api/chat` (and `runProjectOnce` for template authoring). The bundle is assembled in `lib/hermes/agents.ts` and references:

- Agents in `.hermes/agents/`
- The `/ui-builder` bundle in `.hermes/bundles/ui-builder/BUNDLE.md`
- Skills in `.hermes/skills/` (ui-builder set: security-review, hermes-gateway, visual-selector, theme-system, frontend-design, generated-app-standards, project-runtime)
- Hooks in `.hermes/hooks/`
- Commands in `.hermes/commands/`

Modes:

- `project-edit` — normal generated project workspace under `.apploop/projects/`
- `template-edit` — chat on a project whose workspace is `templates/<id>`
- `template-authoring` — Create Template gateway pass before redirect into template edit
- `presentation-edit` — Marp deck under `.apploop/presentations/<slug>/`; source of truth is `deck.md`

Presentation Hermes assets:

- Agent: `.hermes/agents/presentation-builder.md`
- Bundle: `.hermes/bundles/marp-builder/BUNDLE.md`
- Skill: `.hermes/skills/marp-presentations/SKILL.md`
- Command: `.hermes/commands/presentation-build.md`
- Hook: `.hermes/hooks/presentation-scope-guard/HOOK.md`

The app owns project state and runtime control. Hermes agents own generated-project edit workflows. Presentation runs own Markdown-only Marp edits. Keep that boundary clear.

## Security Rules

- Never expose `HERMES_API_KEY`, `API_SERVER_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, or provider secrets to browser code.
- Treat browser-provided project ids, routes, ports, process ids, workspace paths, and Hermes session ids as untrusted.
- Use path containment helpers in `lib/security/paths.ts` for filesystem work.
- Use command allow-list helpers in `lib/security/commands.ts` for runtime commands.
- Preserve iframe origin and nonce checks in preview messaging.
