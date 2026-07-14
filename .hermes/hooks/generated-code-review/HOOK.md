---
name: generated-code-review
description: "Reviews generated project diffs for AppLoop code-standard violations before completion."
version: 1.0.0
trigger: post-edit
---

# Generated Code Review Hook

## Inputs

- `workspacePath`: trusted generated project root.
- `changedFiles`: generated project files changed by the run.
- `diff`: bounded diff or file snapshots for review.

## Outputs

- `allow`: no blocking generated-code violation found.
- `block`: violation report routed to validation repair.
- `violations`: file, rule id, and smallest suggested repair.

## Checks

- Default exports in non-route component files.
- Formatting drift from project conventions.
- Relative imports that traverse more than one parent directory.
- Non-kebab-case filenames.
- More than one PascalCase component export in a component file.
- PascalCase component export does not match the kebab-case filename.
- Route module filename is not one of `actions.ts`, `schema.ts`, `hooks.ts`, `atoms.ts`, `types.ts`, `utils.ts`, or `constants.ts`, and is not in a route-local `components/` folder.
- `schema.ts` files missing the `PositionSchema` plus `z.infer<typeof PositionSchema>` pattern.
- `actions.ts` files missing exported async verb-noun function declarations.
- Missing semantic class names on inspectable boundaries when required by design output.
- Generic boundary names such as `box`, `item`, or `wrapper` on important layout regions.
- Duplicate `data-builder-id` values in the same rendered route.
- Invalid `data-builder-id` values; use kebab-case identifiers such as `dashboard-revenue-card`.
- Missing or wrong template classname on `<body>`: must be `template-default` for generated-nextjs-default projects or `template-admin-luma` for generated-nextjs-admin-luma projects.
- Template classname removed, renamed, or moved from `<body>` to a descendant element.
- Repeated elements (`.map()` rendered items) missing unique per-instance classnames. Shared classnames like `metric-card summary-card` are not sufficient — each instance needs a unique descriptive classname (e.g. `metric-revenue`, `metric-active-users`).
- Repeated elements using generic suffixes like `-1`, `-2`, `-a`, `-b` instead of descriptive kebab-case names.

## Completion Criteria

- Every changed generated source file is reviewed.
- Each violation names the file and rule.
- The hook does not edit files directly; it routes repair work to validation repair.