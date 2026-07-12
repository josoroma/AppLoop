---
name: theme-integrity
description: "Checks generated project theme changes for semantic token integrity, dark-mode coverage, and hard-coded color drift."
version: 1.0.0
trigger: post-edit
---

# Theme Integrity Hook

## Inputs

- `workspacePath`: trusted generated project root.
- `selectedThemeId`: server-resolved theme id.
- `changedFiles`: generated files touched by the run.

## Outputs

- `allow`: theme usage is consistent.
- `block`: theme issue report routed to validation repair.
- `suggestions`: nearest semantic token suggestions when hard-coded colors are found.

## Checks

- Detect arbitrary hex, rgb, hsl, or bracket color utilities in generated components.
- Verify required light token variables are present.
- Verify dark token block coverage.
- Verify `--radius`, sidebar tokens, and `--chart-1` through `--chart-5` are present.
- Verify chart tokens are differentiated enough to be usable in visualizations.
- Verify token files match the selected project theme id.
- Reject custom theme CSS containing imports, URLs, remote assets, or selectors other than `:root` and `.dark`.
- Allow hard-coded colors only when an explicit non-theme reason is recorded.

## Completion Criteria

- No unapproved hard-coded colors remain.
- Light and dark tokens are complete.
- Generated components use semantic variables or theme-aware classes instead of hard-coded theme colors.
- Theme id and token file are consistent.