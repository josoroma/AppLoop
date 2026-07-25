---
name: presentation-scope-guard
description: "Pre-tool guard for Marp presentation workspaces: block writes outside the active presentation root."
version: 1.0.0
---

# Presentation Scope Guard

## Trigger

`pre-tool-use`

## Inputs

- `workspacePath`
- `operation`
- `targets`

## Enforcement

1. Normalize and realpath-resolve every target path.
2. Allow read/write only under the exact presentation `workspacePath`.
3. Block traversal outside that root.
4. Block edits to AppLoop builder source, `.hermes` assets, `templates/`, `presentations-templates/` blueprints, and sibling presentation/project workspaces.
5. Block package manager installs and Next.js runtime commands.
6. Log blocked operations.

## Outputs

- `allow` / `block`
- `auditLog`
