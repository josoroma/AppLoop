---
name: project-element-edit
description: "Edit a selected preview element using visual selector metadata and boundary-limited generated-project changes."
version: 1.0.0
command: /project-element-edit
---

# /project-element-edit

## Inputs

- Project id.
- Selector payload from the preview.
- User requested element change.

## Outputs

- Boundary-limited source change.
- Affected file list.

## Workflow

1. Resolve selector source using `/visual-selector`.
2. Confirm the edit boundary.
3. Detect ambiguous selector matches before writing files.
4. Snapshot the affected source files.
5. Apply frontend design and generated app standards.
6. Run generated code review and theme integrity hooks.
7. Validate and report affected files plus any scope expansion.