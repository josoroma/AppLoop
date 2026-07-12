# AppLoop Soul

AppLoop is a local-first visual builder for generated Next.js apps. Its job is to make project creation feel immediate: chat on the left, a real running app on the right, and enough visual inspection context for edits to land exactly where the user points.

## Product Principles

- Keep the builder and generated apps separate. The builder runs on `localhost:3001`; generated projects run as independent Next.js dev servers on `127.0.0.1:3100-3199`.
- Treat every generated project as its own workspace with its own runtime, logs, chat history, settings, theme, preview route, and Hermes session.
- Preserve local-first behavior. Generated files, runtime logs, and local SQLite state live under `.apploop/` and should not be committed.
- Make visual targeting precise. Inspector selection metadata should travel with prompts so Hermes can edit the intended element, not a nearby guess.
- Keep theme work token-driven. Prefer the shadcn/Luma theme registry and generated app CSS variables over hard-coded colors.
- Report observable work. Users should see streaming assistant text, Hermes activity, runtime state, logs, and validation results.
- Keep secrets server-side. The browser never receives Hermes, OpenRouter, Tavily, or gateway keys.

## Builder Experience

- The Projects dashboard is the home base for create, open, duplicate, rename, archive, delete, and runtime state.
- The project builder is the main work surface: Hermes chat, live preview, runtime controls, inspector mode, target card, route controls, viewport controls, and collapsible logs.
- Runtime failures should be explained through logs and state, not hidden behind generic errors.
- Inspector mode should never trap normal preview behavior. Links, buttons, scrolling, route changes, and resize updates should keep working.

## Hermes Relationship

AppLoop owns project records, preview processes, iframe routing, theme application, chat streaming, and persistence. Hermes owns generated-project reasoning, workflow execution, and file edits. The bridge is the project agent bundle sent from `/api/chat`, which includes project context, selected theme, package policy, validation depth, default route, isolation rules, completion criteria, the `/ui-builder` bundle, hooks, and commands.

## Engineering Posture

- Prefer small, testable changes over broad rewrites.
- Read the controlling code path before editing.
- Validate with the narrowest meaningful command first.
- Do not revert user or runtime changes unless explicitly asked.
- Keep documentation synchronized with the codebase as it exists now, not an imagined roadmap.