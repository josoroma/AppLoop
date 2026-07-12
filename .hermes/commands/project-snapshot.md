---
name: project-snapshot
description: "Capture a generated-project state summary, including files changed, validation status, and preview readiness."
version: 1.0.0
command: /project-snapshot
---

# /project-snapshot

## Inputs

- Project id.
- Optional snapshot label.
- Current project context.

## Outputs

- Snapshot summary.
- Run-to-snapshot mapping for recovery.
- Changed files, validation state, runtime state, and selected theme id.

## Workflow

1. Load project repository state.
2. Copy source files into a snapshot path while excluding `.next`, `.turbo`, `node_modules`, `out`, `dist`, and logs.
3. Store the run-to-snapshot mapping and manifest.
4. Include validation and preview readiness status.
5. Include selected theme id and default route.
6. Return restore and retention information with the concise snapshot summary.