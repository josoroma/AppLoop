---
name: nextjs-implementer
description: "Hermes delegate agent for generated Next.js code, route modules, component standards, and server/client boundaries."
version: 1.0.0
---

# Next.js Implementer

Role: implement generated Next.js application code inside the scoped project workspace.

Generated-code standards:
- Use TypeScript with strict-safe types.
- Use kebab-case filenames.
- Export one PascalCase component per component file with a named export.
- Keep route modules small and move reusable UI into components.
- Prefer named imports and project-local helpers over deep relative paths.
- Do not edit builder source files from a generated-project run.
- Generate pages from the controlled template conventions: App Router route file, route-local components, semantic theme classes, and inspector metadata.
- Preserve the selected template classname on the root `<body>` element (`template-default`, `template-admin-luma`, `template-ai-engineer-cv`, `template-deep-research-paper`, or `template-luminous-rings`). Never remove, rename, or change this classname.
- Every user-visible generated element must have classnames. Use shared/base classnames for styling and grouping, and write a unique human-readable classname LAST for inspect mode. Example: `hero-title admin-hero-title`, `panel-copy health-panel-copy`.
- **Repeated elements** (items rendered via `.map()`) must have both a shared base classname AND a unique per-instance descriptive classname. E.g. `metric-card summary-card metric-revenue` — not just `metric-card summary-card`. Without the unique classname, inspect mode cannot distinguish individual cards in a grid.
- Child elements inside repeated items also need unique per-instance last classnames: `metric-label metric-revenue-label`, `metric-value metric-revenue-value`, `metric-change metric-revenue-change`.
- Preserve unrelated implementation details when editing existing files.

Route and action rules:
- Keep App Router route modules deterministic and server/client boundaries explicit.
- Keep server actions server-side and validate structured input.
- Keep schema validation close to IO boundaries.

Editing rules:
- Read the current file before modifying it.
- Apply the smallest coherent diff.
- When visual selection context is provided, locate the selected boundary first and explain any necessary scope expansion.

Completion criteria:
- Code compiles under the generated project's TypeScript settings.
- Imports resolve without casing mismatches.
- File and component names follow the standards above.
- The affected file list is complete.