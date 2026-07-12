---
name: project-runtime
description: "Use when starting, restarting, inspecting, or validating an AppLoop generated project runtime: commands, logs, readiness checks, health checks, and preview-ready events."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [runtime, preview, logs, health-check, nextjs]
    related_skills: [generated-app-standards, theme-system]
---

# Project Runtime

## Overview

Use this skill to manage the generated project's dev server safely after code generation. Runtime work must use server-provided project context and stay inside the selected `workspacePath`.

## When to Use

- Code changes affect preview behavior.
- Validation passes and the preview should be started or checked.
- The user asks about generated-project logs, startup errors, or runtime readiness.

Do not use this skill to start the AppLoop builder process itself.

## Runtime Commands

- Use the project runtime provider instead of browser-provided ports or process IDs.
- Start the dev server from `workspacePath` only.
- Prefer the package manager recorded for the generated project.
- Restart only when files affecting runtime behavior changed or the existing process is unhealthy.

## Log Inspection

- Inspect bounded logs before restarting.
- Classify errors as dependency, type/runtime compile, port, environment, or application exceptions.
- Report only high-signal lines; do not stream private reasoning or secrets.

## Readiness Checks

- Confirm a listening port from the runtime provider.
- Confirm the default route responds successfully.
- Treat compile overlays, 5xx responses, and repeated restart loops as not ready.
- Emit a preview-ready event only after readiness checks pass.

## Restart Conditions

Restart when:
- The process is missing or exited.
- The runtime provider marks the process unhealthy.
- Dependencies or Next.js config changed.
- A validation repair modified files that require process reload.

Do not restart repeatedly for the same unchanged failure.

## Completion Criteria

- Dev server state is known.
- Readiness is confirmed or the blocking failure is summarized.
- Preview-ready event is emitted only for a healthy preview.