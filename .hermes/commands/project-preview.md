---
name: project-preview
description: "Start, restart, or inspect the selected generated project's preview runtime."
version: 1.0.0
command: /project-preview
---

# /project-preview

## Inputs

- Project id.
- Default route.
- Optional user request to start, restart, inspect, or summarize logs.

## Outputs

- Runtime state.
- Preview URL or blocking readiness failure.

## Workflow

1. Load runtime state from the project runtime provider.
2. Start or restart only when required.
3. Inspect bounded logs.
4. Run preview readiness checks.
5. Emit preview-ready after success.