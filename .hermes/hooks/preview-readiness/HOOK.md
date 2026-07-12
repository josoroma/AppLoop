---
name: preview-readiness
description: "Blocks Hermes run completion until the generated project process, HTTP route, and recent compile logs are healthy."
version: 1.0.0
trigger: before-completion
---

# Preview Readiness Hook

## Inputs

- `workspacePath`: trusted generated project root.
- `defaultRoute`: server-resolved route for preview checks.
- `runtimeState`: process id, port, status, and bounded logs from the runtime provider.

## Outputs

- `allow`: preview is ready and a preview-ready event may be emitted.
- `block`: completion must route failure to validation repair.
- `previewReady`: event payload with route and port after success.

## Checks

- Confirm the runtime process is running.
- Confirm the HTTP route is reachable.
- Inspect recent logs for compile errors and repeated restart loops.
- Reject completion on 5xx responses, compile overlays, or missing runtime state.
- Emit preview-ready only after all checks pass.

## Completion Criteria

- Runtime status is known.
- HTTP reachability is confirmed.
- Recent compile logs are clean.
- Preview-ready is emitted only for a healthy preview.