---
name: project-theme
description: "Apply, preview, or rollback the selected Luma/shadcn theme for a generated project."
version: 1.0.0
command: /project-theme
---

# /project-theme

## Inputs

- Project id.
- Selected theme id.
- Optional custom theme CSS containing only `:root` and `.dark` blocks.
- Theme operation: apply, preview, migrate, or rollback.

## Outputs

- Updated token files or rollback result.
- Theme validation summary.

## Workflow

1. Resolve selected theme from trusted project settings.
2. Apply semantic light and dark tokens.
3. Validate required variables, custom CSS safety rules, and chart-token differentiation.
4. Run theme integrity hook.
5. Preview affected route when needed.
6. Roll back on theme-caused validation failure.