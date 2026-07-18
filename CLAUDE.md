# Claude Guidance For AppLoop

Use this file as project-specific guidance for Claude or Claude Code sessions working in AppLoop.

## Start Here

- Read `README.md` for setup, architecture, screenshots, environment variables, and Hermes asset documentation.
- Read `docs/SPECS.md` for the current implementation spec.
- Check `AGENTS.md` for general coding-agent rules.
- Keep root `SOUL.md` in mind for product principles and boundaries.

## What This App Is

AppLoop is a local-first visual builder for generated Next.js apps. The builder runs on `localhost:3001`; generated projects run as separate Next.js dev servers on `127.0.0.1:3100-3199` from `.apploop/projects/<slug>`.

The main user workflow is:

1. Create or open a project from `/projects`.
2. Start the generated preview runtime.
3. Chat with Hermes in the builder shell.
4. Optionally inspect a preview element and send the selected classname context with the prompt.
5. Validate generated edits and preview readiness.

## Common Development Tasks

- Builder UI changes usually touch `components/builder/`.
- Project dashboard changes usually touch `app/projects/page.tsx` and `components/projects/`.
- Generated template changes live in `templates/default/` or `templates/admin-luma/`.
- Visual inspector changes often require edits in both `components/builder/preview-frame.tsx` and `templates/*/components/inspector-provider.tsx`.
- Runtime lifecycle changes live in `lib/runtime/`.
- Hermes run metadata lives in `lib/hermes/` and `.hermes/`.
- Theme catalog and application changes live in `lib/themes/`.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
make hermes-gateway
```

Use focused tests when possible. For docs-only changes, run:

```bash
git diff --check
```

## Environment

Copy `.env-example` to `.env` for local configuration. OpenRouter is configured through `OPENROUTER_API_KEY` and Hermes model/provider variables. Tavily is optional through `TAVILY_API_KEY` for Hermes search-capable workflows. The repo-local Hermes YAML is `.hermes/config.yaml`.

Do not print, commit, or move real secrets into browser-visible code.

## Editing Rules

- Do not revert unrelated user changes.
- Keep diffs small and local.
- Use existing services and schemas before adding new ones.
- Do not hand-roll process, path, or command safety when helpers already exist.
- Update active generated workspaces only when needed to validate a live preview issue; keep templates synchronized when the fix should apply to future projects.
- Do not add screenshots with arbitrary resizing unless explicitly requested.

## Validation Notes

- Use `npm run lint` and `npm run typecheck` for broad TypeScript/UI changes.
- Use Vitest slices for specific domains.
- Use Playwright/browser checks for iframe, inspector, and runtime preview behavior.
- Runtime log streams can keep browser pages from reaching `networkidle`; prefer `domcontentloaded` plus a text or selector wait.