# Agent Instructions For AppLoop

These instructions apply to coding agents working in this repository.

## Project Summary

AppLoop is a Next.js visual app builder. The main builder runs on `http://localhost:3001`. Generated Next.js apps are copied from `templates/` into `.apploop/projects/<slug>` and run on preview ports in the `3100-3199` range.

Key surfaces:

- Builder pages: `app/projects/page.tsx` and `app/projects/[projectId]/page.tsx`
- Builder UI: `components/builder/`
- Project creation and files: `lib/projects/`
- Runtime lifecycle: `lib/runtime/`
- Hermes integration: `lib/hermes/` and `.hermes/`
- Themes: `lib/themes/`
- Visual inspector: `lib/visual-selector/`, `components/builder/preview-frame.tsx`, and `templates/*/components/inspector-provider.tsx`
- Persistence: `lib/db/`
- Security helpers: `lib/security/`

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
make dev
make check
make hermes-gateway
make hermes-gateway-curl-test
```

If the shell prompts to source `.env` during validation, answer `N` unless the task specifically requires local secrets.

## Local State And Generated Files

- Do not commit `.apploop/`, `.next/`, runtime logs, local SQLite databases, Hermes auth files, Hermes logs, Hermes cache, or local gateway state.
- Generated project workspaces under `.apploop/projects/` may need temporary edits for live validation, but durable template changes should usually be made under `templates/` as well.
- If the active generated workspace is relevant to a user-reported preview bug, patch the active `.apploop/projects/<slug>` copy and the source template when appropriate.

## Coding Guidelines

- Keep changes scoped to the requested behavior.
- Prefer existing local services, schemas, and helpers over new abstractions.
- Preserve strict TypeScript and existing component style.
- Use structured parsing and Zod schemas where the codebase already does.
- Keep UI text concise and functional.
- Avoid hard-coded generated app colors; use theme tokens from `lib/themes/registry.ts`.
- Keep visual selector payloads compatible with `lib/visual-selector/types.ts`.
- Remember that `getBoundingClientRect()` can return negative `x` or `y` for scrolled elements.

## Validation Expectations

Choose the narrowest meaningful check after edits:

- Visual selector changes: `npm test -- tests/visual-selector.test.ts`
- Runtime changes: `npm test -- tests/runtime*.test.ts tests/preview-browser.test.ts`
- Theme changes: `npm test -- tests/theme-system.test.ts`
- Project domain changes: `npm test -- tests/project-*.test.ts`
- General TypeScript or UI changes: `npm run lint` and `npm run typecheck`
- Browser behavior: use Playwright against the running builder when available.

Always run `git diff --check` for documentation-only or screenshot-only changes.

## Hermes Assets

AppLoop sends a Hermes project agent bundle from `/api/chat`. The bundle is assembled in `lib/hermes/agents.ts` and references:

- Agents in `.hermes/agents/`
- The `/ui-builder` bundle in `.hermes/bundles/ui-builder/BUNDLE.md`
- Skills in `.hermes/skills/`
- Hooks in `.hermes/hooks/`
- Commands in `.hermes/commands/`

The app owns project state and runtime control. Hermes agents own generated-project edit workflows. Keep that boundary clear.

## Security Rules

- Never expose `HERMES_API_KEY`, `API_SERVER_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, or provider secrets to browser code.
- Treat browser-provided project ids, routes, ports, process ids, workspace paths, and Hermes session ids as untrusted.
- Use path containment helpers in `lib/security/paths.ts` for filesystem work.
- Use command allow-list helpers in `lib/security/commands.ts` for runtime commands.
- Preserve iframe origin and nonce checks in preview messaging.