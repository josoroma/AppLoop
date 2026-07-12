---
name: security-review
description: "Use when reviewing AppLoop generated-project actions for path containment, secret exposure, dangerous commands, runtime isolation, and preview iframe boundaries."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [security, isolation, secrets, commands, iframe]
    related_skills: [project-runtime, generated-app-standards]
---

# Security Review

## Overview

Use this skill to review generated-project plans and edits before completion. It mirrors the security auditor agent's checklist in reusable skill form so the UI builder bundle has an explicit security capability.

## When to Use

- A run proposes file access, shell commands, dependency installation, runtime changes, or iframe communication.
- A prompt includes paths, ports, process IDs, or environment values from the browser.
- A generated app change could expose secrets or weaken isolation.

## Checks

- Path containment: every file read, write, and command target must stay under `workspacePath` after normalization and realpath resolution.
- Secret exposure: never print, persist, or send Hermes API keys or environment secrets to browser code; `NEXT_PUBLIC_HERMES_*` is forbidden.
- Dangerous commands: reject destructive, global, privilege-escalating, or cross-project commands and use an allowlisted environment.
- Runtime isolation: do not trust browser-provided ports, process IDs, paths, or session IDs.
- Iframe boundary: preview communication must use approved AppLoop channels with project id and preview nonce verification.
- Theme sanitization: custom themes may contain only `:root` and `.dark` token declarations.
- Project authorization: project-scoped routes must verify active project access before returning metadata or streams.

## Decisions

- `approved`: no blocking issue found.
- `blocked`: unsafe operation found; report the violated rule and smallest safe correction.
- `needs-context`: missing server-side project context prevents a decision.

## Completion Criteria

- All proposed operations are approved or blocked.
- Blocked operations include a concrete replacement path.
- No secret values appear in user-facing output.