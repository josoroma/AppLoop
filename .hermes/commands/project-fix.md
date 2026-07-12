---
name: project-fix
description: "Repair validation, lint, runtime, or preview failures in the selected generated project."
version: 1.0.0
command: /project-fix
---

# /project-fix

## Inputs

- Project id.
- Failure summary, command output, or runtime logs.
- Server-resolved workspace path.

## Outputs

- Smallest repair applied inside the generated project.
- Rerun validation result.

## Workflow

1. Classify the failure.
2. Locate the smallest affected files.
3. Snapshot affected files before repair.
4. Apply generated app standards.
5. Rerun the failing check.
6. Stop after bounded repair attempts.