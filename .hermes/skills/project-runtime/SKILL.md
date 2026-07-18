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
- Before starting, verify `package.json` exists and `node_modules/` is present. If dependencies are missing but `package.json` is valid, install from inside `workspacePath` (`npm install` or `pnpm install`) before launching `next dev`; copied templates intentionally exclude `node_modules`.
- Restart only when files affecting runtime behavior changed or the existing process is unhealthy.
- When choosing a runtime port, treat both other projects' `projects.preview_port` values and existing `runtimes.port` rows as reserved. A stopped/stale runtime row can still trip the SQLite `runtimes_port_idx` unique index even if the OS port is available, so don't filter by port value alone — exclude only the current project's own runtime/preview ports.

## Log Inspection

- Inspect bounded logs before restarting.
- Classify errors as dependency, type/runtime compile, port, environment, or application exceptions.
- Report only high-signal lines; do not stream private reasoning or secrets.

**See also**: [`references/finding-port.md`](references/finding-port.md) — discovering which port a generated project runs on when multiple Next.js servers are active.

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
   cp templates/default/components/inspector-provider.tsx \
      .apploop/projects/<slug>/components/inspector-provider.tsx
   ```
3. **Restart the generated runtime** so the dev server picks up the change.
4. **Verify** the feature works in the preview.

Skipping step 2 is the most common cause of "the feature code is correct but nothing happens in preview." The builder hot-reloads, but the generated app inside the iframe runs its own dev server with its own file copies.

### Generated → Template Reverse Sync

When a user customizes a generated project inside AppLoop (edited CSS, tweaked layout, new content) and wants the changes to become the permanent template default, sync the generated project files **back** to the matching template source:

```bash
# 1. Identify the template from the generated project's body classname
grep "template-" .apploop/projects/<slug>/app/layout.tsx

# 2. Diff to see what changed
diff .apploop/projects/<slug>/app/globals.css templates/<id>/app/globals.css

# 3. Copy changed files back to the template
cp .apploop/projects/<slug>/app/globals.css templates/<id>/app/globals.css
cp .apploop/projects/<slug>/app/page.tsx     templates/<id>/app/page.tsx
cp .apploop/projects/<slug>/app/layout.tsx   templates/<id>/app/layout.tsx

# 4. Re-typecheck the template and run audits
npm --prefix "templates/<id>" run typecheck
npm test -- tests/generated-code-standards.test.ts

# 5. If the project added new dependencies (e.g. lucide-react), update template's package.json too
```

**Pitfall — template palette drift**: When syncing generated→template, check that the `:root`/`.dark` CSS tokens match the registered theme. Use `lib/themes/registry.ts` → `canonicalLight`/`canonicalDark` as the canonical token set for `luma-indigo-emerald`. Hardcoded `oklch`/`rgb()` values that diverge from the theme tokens should be replaced with token references (`var(--primary)`, `var(--sidebar)`, `--sidebar-foreground`, etc.) so the template stays in sync with the theme system.

## Runtime Lifecycle Automation

The builder-shell (`components/builder/builder-shell.tsx`) manages three runtime lifecycle events:

### Auto-Start on Page Load

When the project page loads (user opens a project), a `useEffect` with `[]` deps calls `startRuntimeAction`. `startProject` in the runtime service already handles kill-before-start — if a process is already running for the project, it sends SIGTERM, waits 5s, then spawns a fresh dev server. No manual start button click needed.

### Post-Hermes Restart

After each Hermes response completes (chat status transitions from `"streaming"` → `"ready"`), a `useEffect` calls `restartRuntimeAction`. This restarts the Next.js dev server to pick up any CSS/JS changes Hermes made to the generated project. Combined with `CHOKIDAR_USEPOLLING=true` in the dev script, this ensures changes are always visible immediately.

### Preview Reload After File Revert

When a user clicks **Restore** or **Edit** on a past message, `revertToFileSnapshot` runs `git reset --hard` inside the workspace. The Next.js dev server's file watchers often miss this large atomic operation — the iframe must be forced to reload. The handler calls `setPreviewReloadKey(k => k + 1)`, which changes the iframe's `key` prop (`key={`${frameSrc}-${reloadKey}`}` in `preview-frame.tsx`), causing React to unmount and remount the iframe from scratch. Without this step, the preview shows stale pre-revert content.

### Force Kill on Stop

`stopProject` sends SIGTERM and waits 5 seconds. If the process survives, `terminateProcessTreeForce` sends SIGKILL to the process and all children (via negative PID on macOS/Linux, `childProcess.kill("SIGKILL")` on Windows). This ensures the port is freed and the process tree is fully terminated before a new runtime starts.

## File Snapshots (Git-Based Checkpoints)

Every prompt send creates a git checkpoint in the generated project workspace via `createFileSnapshot(projectId)` in `lib/chat/file-snapshot.ts`.

### Per-Project Git Initialization

Each project workspace MUST have its own independent `.git` repo — it cannot operate inside the parent AppLoop repo because AppLoop's `.gitignore` excludes `.apploop/`, making all project files invisible to `git add`.

`createFileSnapshot` detects parent-repo contamination by comparing `git rev-parse --show-toplevel` against the workspace path. If they don't match (toplevel is the AppLoop root, not the workspace), it does `git init` + creates a `.gitignore` (`node_modules/`, `.next/`, `.turbo/`, `dist/`, `out/`, `logs/`, `.apploop/`) + initial commit. On subsequent calls, `git add -A` stages actual project files.

### Restore / Edit Flow

1. Find checkpoint matching the user message's ID
2. `revertToFileSnapshot(projectId, commitHash)` — `git reset --hard <hash>` + `git clean -fd`
3. Truncate chat to checkpoint message IDs
4. `loadCheckpoint(cp.id)` — restore selected elements and screenshots
5. **Edit only** — pre-fill textarea with original prompt (stripping "Target classnames" suffix)
6. `restartRuntimeAction` via FormData — kill + restart the dev server to ensure fresh file reads after `git reset --hard` (file watchers often miss the atomic git operation)
7. `setPreviewReloadKey(k => k + 1)` — force iframe remount via key change (belt-and-suspenders; the runtime restart alone re-validates the server component, but the reloadKey guarantees the iframe picks up the new state)

### Key Files

| File | Role |
|------|------|
| `lib/chat/file-snapshot.ts` | `createFileSnapshot` (git commit), `revertToFileSnapshot` (git reset --hard), per-project git init detection |
| `components/builder/builder-shell.tsx` | Auto-checkpoint on send, Restore/Edit onClick handlers, `setPreviewReloadKey` trigger |
| `components/builder/preview-frame.tsx` | `key={frameSrc-reloadKey}` on iframe — changing key forces React remount |

## Runtime Stop Behavior

When the runtime is stopped (manually or via `stopRuntimeAction`), the builder automatically clears all inspect-mode selections via a `useEffect` watching `runtimeStatus`. This ensures stale selection overlays don't persist when the preview iframe is unloaded. No additional cleanup is needed when stopping the runtime during inspect mode.

## Missing `package.json` In Generated Workspace

**Symptom**: Starting a generated project runtime fails with:

```text
Generated project workspace is missing package.json.
```

**Durable causes to check**:
1. The `projects.workspace_path` DB row points at a directory that does not exist or was partially created.
2. The selected source template contains transient folders such as `node_modules/` or `.next/`, and project creation copied them directly; huge transient copies can leave broken or incomplete generated workspaces.
3. A generated workspace was repaired or copied without preserving root files such as `package.json`, `app/`, `components/`, `tsconfig.json`, and lockfiles.

**Fix pattern**:
1. Query the project row and verify `workspace_path`.
2. Check `workspace_path/package.json`, `workspace_path/app/layout.tsx`, and the template body classname.
3. Repair by recopying from the matching `templates/<id>/` into the exact DB `workspace_path`, excluding transient folders: `.next`, `.turbo`, `node_modules`, `out`, `dist`, and `logs`.
4. Recreate the generated workspace `.gitignore` and initialize its local git repo if needed.
5. Run `npm install` or `pnpm install` inside the generated workspace if dependencies are missing; `Module not found` for template dependencies such as `@react-three/fiber`, `@react-three/drei`, or `three` usually means `node_modules/` is absent after a transient-filtered copy.
6. Validate with `npm run typecheck`, then start the generated app directly with `npm run dev -- --hostname 127.0.0.1 --port <project.preview_port>` and confirm `curl` returns HTTP 200.
7. Stop the manual dev server before handing control back to AppLoop's runtime provider.

**Prevention in AppLoop source**: `createProjectWorkspace()` must filter transient template paths just like `duplicateProjectWorkspace()` does. Add/keep tests proving specialty templates, especially large templates like `solar-system`, create workspaces with `package.json` while excluding `node_modules` and `.next`.

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

**Prevention**: Never copy template files to a generated project without confirming which template the project uses. Check `grep "template-" .apploop/projects/<slug>/app/layout.tsx` — the body classname maps to exactly one source template (`template-default`, `template-admin-luma`, `template-ai-engineer-cv`, `template-deep-research-paper`, or `template-luminous-rings`). Templates can have incompatible shell/components, so copy only from the matching source template.

## Tailwind v4 CSS Cache

**Symptom**: CSS changes in `globals.css` are not picked up by the dev server's hot reload. The file on disk is correct, but the served CSS hash (`_next/static/chunks/_apploop_..._globals_<hash>.css`) never changes, and `curl` on the CSS URL shows stale content.

**Root cause**: Next.js with `@tailwindcss/postcss` (Tailwind v4) may cache compiled CSS output and fail to detect file changes, especially after rapid edits. `touch` is insufficient to trigger recompilation.

**Fix**:
```bash
# 1. Kill the stuck dev server FIRST — never clear .next against a live process
kill $(lsof -ti:<port>)

# 2. Clear the Next.js build cache (only after kill)
rm -rf .apploop/projects/<slug>/.next

# 3. Restart
cd .apploop/projects/<slug> && npm run dev -- --hostname 127.0.0.1 --port <port>

# 4. Verify the new CSS hash is different
curl -s http://127.0.0.1:<port>/ | grep -o 'href="[^"]*\\.css[^"]*"'
```

**Pitfall — clearing .next on a live server**: Running `rm -rf .next` while the dev server is still listening corrupts its in-memory state. The server keeps stale handles to now-deleted chunks, producing `MODULE_NOT_FOUND` (e.g. `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`) and `ENOENT` (`routes-manifest.json`). After that, every request 500s until you kill and restart. Always kill first.

**Pitfall — auto-restart reverts uncommitted changes**: When you kill the dev server, AppLoop's `kill-before-start` flow in `startRuntimeAction` may trigger a `git reset --hard` as part of the file-snapshot restore logic. This wipes all uncommitted file changes in the generated project workspace, including the CSS edits you just made. **Before killing the server to clear `.next`, commit your changes to the workspace's git repo**:

```bash
cd .apploop/projects/<slug> && git add -A && git commit -m "wip: <description>"
```

Then kill + clear + restart. Without this commit, your edits silently vanish and you'll waste cycles re-applying them.

**Prevention**: After making CSS changes via an agent, check whether the served CSS reflects the change before declaring success. If the hash hasn't changed, commit changes to git first, then clear `.next` and restart.

**Permanent prevention for new projects**: The template `package.json` `dev` script includes `CHOKIDAR_USEPOLLING=true` before `next dev`. This forces Turbopack to use polling-based file watching instead of native OS events (FSEvents/inotify), which can miss changes written by external tools like Hermes. New projects created from the updated templates will have this enabled automatically. Existing projects must have their `dev` script updated manually.

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