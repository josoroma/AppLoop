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

## Template Propagation

Generated projects are created by copying files from `templates/<id>/` into `.apploop/projects/<slug>/` at project creation time. Template changes are **not** automatically synced to existing generated projects. When template code (e.g., `templates/…/inspector-provider.tsx` or `templates/…/app/layout.tsx`) is updated:

1. **Update the template** in `templates/` first.
2. **Sync to the active generated project** by copying the updated file:
   ```bash
   cp templates/generated-nextjs-default/components/inspector-provider.tsx \
      .apploop/projects/<slug>/components/inspector-provider.tsx
   ```
3. **Restart the generated runtime** so the dev server picks up the change.
4. **Verify** the feature works in the preview.

Skipping step 2 is the most common cause of "the feature code is correct but nothing happens in preview." The builder hot-reloads, but the generated app inside the iframe runs its own dev server with its own file copies.

## Stuck Server Diagnosis

**Symptom**: `lsof` shows the port listening, but `curl` times out (exit code 7 or 124). The Next.js dev server process is alive but stuck.

**Common cause**: A compilation error (missing module, broken import) causes Next.js to hang in a retry loop. The port is bound but no requests are served. Check the runtime log:

```bash
tail -20 .apploop/runtime-logs/<projectId>.log
```

**Fix**:
1. Fix the compilation error in the generated project files.
2. Force-kill the stuck process: `kill -9 $(lsof -ti:<port>)`
3. The AppLoop runtime will auto-restart on a new port (Next.js may pick a different port if the old one is briefly occupied).
4. Verify with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/`

**Prevention**: Never copy template files to a generated project without confirming which template the project uses. Check `grep "template-" .apploop/projects/<slug>/app/layout.tsx` — `template-default` means default template, `template-admin-luma` means admin-luma template. The two templates have incompatible shell components (default: `SiteHeader`, admin-luma: `AdminShell`).

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