# Immersive Full-Screen (neon waveform fabric)

Template path: `templates/immersive-full-screen/`.

(Office note: preferred home would be generated-app-standards; that skill is locked/manual — keep this pointer here until it can be copied.)

## Visual target (from user references)

- Square framed composition centered on deep purple/void background
- Hundreds of thin **horizontal** neon polylines (cyan → magenta → violet → coral → warm gold)
- Dense fabric from layered simplex/fbm displacement: waves, folds, valleys, pinches
- Soft bloom, additive blending, chromatic lift on interaction, film grain, atmospheric haze
- Mouse/touch: gravitational lift/attract/repel/twist with spring-smoothed pointer + velocity ripples
- Gentle breath, depth parallax, subtle camera orbit; touch-friendly; resize-safe

## Preferred implementation shape

Do **not** settle for a pure 2D full-screen fragment “fake lines only” if R3F is already a dependency:

- R3F `Canvas` inside a **square frame** (`aspect-ratio: 1/1`, `min(92vmin, …)`)
- `THREE.LineSegments` + custom vertex/fragment shaders (GPU displacement)
- Pointer state in a **ref-owned store** (not props mutated in `useFrame` — trips `react-hooks/immutability`)
- Pass `pointerRef` into scene children; do not read `pointerRef.current` as a freeze-prop during render
- Post: `EffectComposer` + `UnrealBloomPass` + light grain/vignette `ShaderPass`
- Additive blending, fog matching void color (`#12061f`-class)

## Lint / types pitfalls

- No `className` on R3F `<group>` / three host elements — put inspect classes on DOM wrappers (`.neon-field-stage`, `.neon-field-frame`, `.neon-field-canvas`)
- ESLint `react-hooks/immutability`: do not mutate a `pointer` **prop** inside `useFrame`. Mutate `pointerRef.current.*` instead.
- ESLint `react-hooks/refs`: pass the ref object (`pointerRef={pointerRef}`), never `pointer={pointerRef.current}` during render
- Default template theme provider / `html` to **dark** for this aesthetic
- GLSL strings: never corrupt `dot()` (watch for bad edits like `destin(`/`hat(`)

## Classnames / identity

- Body: `template-immersive-full-screen`
- Stage/frame/canvas get unique last classnames for inspect
- Add R3F scene filenames to generated-code-standards audit ignore when classname walk false-positives three hosts (`neon-field-scene.tsx`)

## Verify

```bash
npm --prefix templates/immersive-full-screen run typecheck
npx eslint templates/immersive-full-screen/components/neon-field-scene.tsx \
  templates/immersive-full-screen/app/page.tsx \
  templates/immersive-full-screen/app/layout.tsx \
  templates/immersive-full-screen/components/theme-provider.tsx --max-warnings 0
```

## Seed note

`make seed` installs deps for every `templates/*/package.json`; demo project cards only appear if registered in `BUILT_IN_PROJECT_TEMPLATES` or created as a ready custom template.
