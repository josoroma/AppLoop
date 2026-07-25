# Stay Curious — immersive monochrome particle landing

Canonical source: `templates/stay-curious/` (in-repo tree, **not** a git submodule).

## Product shape

- Full-viewport black stage (`100dvh`), no `SiteHeader` / nav chrome
- Headline overlay left: **“Provoke curiosity.”** — `pointer-events: none`
- Body class: `template-stay-curious`
- Hero: `components/curiosity-hero.tsx` (R3F client)

## Deps (React 19)

```json
"@react-three/fiber": "^9.6.1",
"@react-three/drei": "^10.7.7",
"@react-three/postprocessing": "^3.0.4",
"three": "^0.174.0"
```

Fiber **v8** + React 19 → runtime `ReactCurrentOwner` crash on import.

## Implementation pointers

- Patterns: skill `r3f-template-patterns` §§0, 5–6
- Cursor / shockwave / morph knobs: `r3f-template-patterns/references/responsive-particle-field.md`
- Specialty registration notes: skill `apploop-specialty-templates` → “Immersive monochrome particle landings”
- GLSL: `gl_PointCoord` fragment-only; fake motion blur via `aSpeed` (no stock MotionBlur export)

## Ship hygiene

If the folder ever gains a nested `.git`, convert to a normal tree before push — see pitfall in [`adding-built-in-template.md`](adding-built-in-template.md).

```bash
npm --prefix templates/stay-curious run typecheck
npm --prefix templates/stay-curious run lint
```

After template edits on a live demo workspace, rsync into `.apploop/projects/<slug>/` (exclude `node_modules`/`.next`/`.git`) and hard-reload the preview.
