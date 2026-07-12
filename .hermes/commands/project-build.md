---
name: project-build
description: "Start a scoped AppLoop project generation run using the UI builder bundle."
version: 1.0.0
command: /project-build
---

# /project-build

## Inputs

- Project id from AppLoop routing.
- User build request.
- Server-resolved project context and UI builder bundle.

## Outputs

- Implemented generated-project change.
- Validation and preview readiness summary.

## Workflow

1. Load trusted project context.
2. Apply `/ui-builder` bundle.
3. Run project scope guard before tool operations.
4. Delegate implementation through project-builder orchestration.
5. Generate route files from controlled template conventions when creating a new page.
6. Snapshot existing files before edits.
7. Validate and report affected files, package policy decisions, and the result.