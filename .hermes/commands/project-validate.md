---
name: project-validate
description: "Run generated-project validation checks and route failures to bounded repair."
version: 1.0.0
command: /project-validate
---

# /project-validate

## Inputs

- Project id.
- Validation depth.
- Optional specific check: typecheck, lint, runtime, theme, or preview.

## Outputs

- Validation result.
- Streamed command status events.
- Parsed TypeScript and lint diagnostics.
- Preview-ready route when runtime health passes.
- Repair recommendation or completed repair summary.

## Workflow

1. Resolve validation depth from project settings.
2. Format changed files when standard or deep validation is selected.
3. Run typecheck and parse diagnostics.
4. Run lint when standard or deep validation is selected.
5. Check root and target-route runtime health when preview is affected.
6. Run visual smoke checks for blank roots and error overlays when enabled.
7. Route failures to validation repair with bounded attempts.
8. Rerun failed checks after repair.
9. Report unresolved blockers with exact commands.