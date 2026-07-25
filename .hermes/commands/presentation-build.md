---
name: presentation-build
description: "Edit a Marp presentation deck.md in the active presentation workspace."
version: 1.0.0
---

# /presentation-build

## Inputs

- `presentationId`
- `message`
- `workspacePath`
- `sourceFile`

## Loads

- `marp-builder`
- `presentation-scope-guard`

## Behavior

1. Read the active Marp source file (`deck.md` by default).
2. Apply the user request as Markdown edits only (raw HTML pills/columns and per-slide `<!-- _class: … -->` directives are valid deck content).
3. Preserve or restore valid Marp front matter, including `header` and `style: |` theming.
4. Preserve AppLoop-managed markup: `apploop-el-*` spans, the `@apploop-inspect-styles` CSS block, `slide-bg-N` directives.
5. Keep the Simple 3-slide starter at three slides unless the user expands scope.
6. Do not run Next.js, package managers, or project runtime tools.
7. Report affected files.

## Outputs

- presentation markdown change summary
- affected files
- remaining questions/blockers
