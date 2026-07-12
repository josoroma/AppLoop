---
name: project-scope-guard
description: "Blocks Hermes tool operations whose normalized and realpath-resolved targets escape the selected project workspace."
version: 1.0.0
trigger: pre-tool-use
---

# Project Scope Guard Hook

## Inputs

- `workspacePath`: trusted server-side project root.
- `operation`: tool name, command, or file action being evaluated.
- `targets`: candidate file paths, directories, command working directories, or runtime paths.

## Outputs

- `allow`: operation may proceed.
- `block`: operation must stop with a user-safe explanation.
- `auditLog`: blocked operation record with normalized path, real path, and violated rule.

## Evaluation

1. Normalize every target path.
2. Resolve symlinks before containment checks.
3. Reject path traversal segments that escape `workspacePath`.
4. Reject absolute paths outside `workspacePath`.
5. Reject special filesystem targets such as `/dev`, `/proc`, and `/sys`.
6. Log blocked operations without secrets or full environment dumps.

## Block Reasons

- `outside-workspace`
- `path-traversal`
- `unresolved-realpath`
- `special-filesystem-path`
- `missing-workspace-context`