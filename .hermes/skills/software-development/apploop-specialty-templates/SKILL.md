---
name: apploop-specialty-templates
description: "Use when creating or revising AppLoop specialty templates beyond plain default (algovivo soft-body, immersive WebGL, neon stages): built-in registry + seed checklist, inspector body classnames, sim/canvas ignore lists, dark-lock themes, left HUD / clean stage patterns, and mesh/controller pitfalls."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [apploop, templates, specialty, soft-body, algovivo, seed, neon]
    related_skills: [apploop-builder-create-flows, generated-app-standards, frontend-design, theme-system]
---

# AppLoop Specialty Templates

## Overview

Specialty templates live under `templates/<id>/` and often need **extra registration** beyond copying a default Next app: built-in catalog entry, seed demos, inspector classname lists, canvas/sim audit ignores, and identity-specific FX (WASM soft bodies, WebGL fields, etc.).

Use this skill when the user asks to create/register a non-default template, or when a specialty preview collapses, races, or looks generically themed.

## When To Use

- New built-in template under `templates/` that should appear in Create Project + `make seed`
- Soft-body / algovivo / physics mesh templates
- Immersive neon stages where HUD/chrome must not cover the effect
- “Looks broken / sticks / too anxious / eyes not needed / move that info left” style iteration on specialty previews

## Built-in registration checklist

1. Scaffold `templates/<id>/` (`package.json` name `generated-apploop-app`)
2. Register in `lib/projects/templates.ts` → `BUILT_IN_PROJECT_TEMPLATES`
3. `<body className="template-<id>">` in `app/layout.tsx`
4. Stable page marker (`data-builder-component` / testable name in `app/page.tsx`)
5. Add `template-<id>` to **every** `templates/*/components/inspector-provider.tsx`
6. Ignore sim/canvas client files in `tests/generated-code-standards.test.ts` `collectTemplateUiFiles`
7. Update `tests/project-management.test.ts` expected IDs + specialty markers
8. Seed: `npx tsx scripts/seed-projects.mts` (or `make apploop-seed-projects`)
9. If a demo workspace already exists: rsync template → `.apploop/projects/<slug>/` excluding `node_modules`/`.next`/`.git`

**Catalog gap:** `apploop-template-seed` installs every disk template; **demo projects only come from** `BUILT_IN_PROJECT_TEMPLATES`. Disk-only folders stay invisible on `/projects` until registered.

## Layout preference (user)

- Left column: copy + feature list + **HUD stats/legend**
- Right column: **clean stage only**
- Do not park important status UI as a large floating overlay on the sim once the mesh looks good
- Face overlays (button eyes, smile, blush) are opt-in — user often rejects them on mesh creatures

## Algovivo / soft-body specialty

Detail recipe: [`references/algovivo-softbody-templates.md`](references/algovivo-softbody-templates.md)

Hard rules:

- Always pass `rsi` + `l0` into `system.set` (missing `rsi` ⇒ stick-figure collapse)
- **Scripted `system.a.set` gaits do not walk.** Measured headless: ≤0.007 u/s forward across 40+ scripted variants (lateral/diagonal/trot phases, retractor levers, shear diagonals) vs **1.71 u/s** for the official quadruped + pretrained MLP policy. If the brief needs real forward locomotion, use the policy
- `MLPPolicy` defaults `active: false` — silent no-op (outputs a=1). Always construct with `active: true`
- Never attach a pretrained MLP policy to a *different* mesh topology. To keep the trained walk AND a custom identity: append new geometry AFTER the original vertex/muscle indices and cap the policy's view (`new nn.MLPPolicy({ system, active: true, numVertices: 62, numMuscles: 38 })`). Policy drives `[0..38)`; scripted code animates only appended muscles (read `system.a.toArray()`, rewrite appended slots, `system.a.set`, then `system.step()`)
- Appendage inertia slows a trained walk — keep add-ons short/low (tall raised tail: 1.71→0.26 u/s; compact low tail ≈0.96 u/s). Sweep sizes headless before shipping
- **Verify locomotion headless in Node** before touching the browser: import `algovivo.min.js` via `file://` URL, `WebAssembly.instantiate(fs.readFileSync(wasm))`, step at 30Hz, measure center-of-mass Δx (`system.pos0.toArray()`); run via `npx tsx`
- Fixed-step sim loop; normal = 30Hz + `system.h ≈ 0.033`. Never step every RAF (~60Hz, feels anxious); never below 16Hz or `h < 0.022` (feels elastic-thrashy)
- Viewport mesh colors come from `SystemViewport` options, not only CSS
- Smaller subject ⇒ larger `viewport.tracker.visibleWorldWidth`

## Neon look recipes (short)

- Creature pass: cyan joints, magenta muscles, dark blue stage
- Orange/fruit pass: orange joints `#ffb347`, lime muscles `#b8ff4a`, warm dark stage
- Robot dog pass: yellow fill `#f5c400`, black edges, orange actuators `#ff5a1f`
- **Black cat pass (latest):** fill `#0d0d0f`, red neon actuators `#ff2a3a`, red-tinted dark stage — keep `draggable: true`
- Dark-lock specialty theme provider when neon readability requires it

Full identity notes also live under frontend-design’s template visual identities when that pack is unlocked.

Product-folder detail for the concrete template: `apploop-builder-create-flows` → `references/algovivo-creature-template.md`.

## Verification

```bash
npm --prefix templates/<id> run typecheck
npm --prefix templates/<id> run lint
npm test -- tests/project-management.test.ts tests/generated-code-standards.test.ts
```

Hard-reload the builder preview after rsync. Volume-holding mesh (not sticks) is the acceptance bar for soft bodies.
