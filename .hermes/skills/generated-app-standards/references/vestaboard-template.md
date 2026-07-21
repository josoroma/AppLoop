# Vestaboard Specialty Template

Use when authoring or redesigning `templates/vestaboard` (split-flap message board studio).

## Identity

- Physical split-flap display, not a generic form page.
- Dark chassis + lit tiles; ambient glow behind the stage.
- Primary workflow: compose → chaotic scramble → settle onto board → optional replay from history.
- Keep `body` classname `template-vestaboard`.
- User feedback signal: “lacks more disorder to word transition” means the final word arrives too cleanly — increase scramble, not polish.

## Layout Hierarchy

1. `vestaboard-header` — brand lockup + live “now showing” / “scrambling” status.
2. `vestaboard-stage` — chassis, rails, 22×6 tile grid.
3. `vestaboard-controls` — preset chips, composer, shuffle/clear, mini-board preview.
4. `vestaboard-history` — recent broadcasts with replay-on-click.
5. `vestaboard-theme-toggle` — fixed corner control.

## Board Mechanics

- Grid is fixed `22` cols × `6` rows (`TOTAL_TILES = 132`).
- Do **not** dump raw left-aligned text into a single padded string for the hero message.
- Use a `layoutMessage()` that:
  - uppercases + strips unsupported chars
  - word-wraps into rows (hard-break words longer than 22)
  - vertically centers used rows
  - horizontally centers each line
- Blank cells use a distinct blank tile style (darker / unlit), not “space char on cream”.
- Guard concurrent broadcasts with an `isBroadcasting` flag while flip timers are live; clear timers on unmount/reentry.

## Chaotic Word Transitions (required feel)

Do **not** crossfade or instantly swap the final message. Message changes should look like a mechanical scramble storm:

1. Diff `fromBoard` vs `toBoard`; optionally shut neighboring unchanged tiles into the storm as collateral (~15–25% of changed count).
2. Build a per-tile `motionMap` with **non-linear, non-row-major** delays (sin/cos + turbulence + random). Per-tile CSS vars for wobble/kick duration are better than a clean left-to-right cascade.
3. Immediately paint a scrambled intermediate board (`scrambleBoard(origin, target, progress≈0.15)`).
4. Run **multi-wave** timed resolves (~6–8 waves). Each wave keeps replacing changed cells with random glyphs from an alphabet (`A–Z0–9!?#@$%&*`) until progress nears settle.
5. Leave late-wave glitches (`progress < 0.9`) so arrival feels imperfect/mechanical.
6. Only the final wave commits the exact `target` board and clears flip state.
7. Replay and clear should reuse the same engine (`scrambleAll` allowed for full-board chaos).

CSS prosthetics that help:

- Full multi-keyframe 360° `rotateX` flip with Z wobble + Y kick, not a single 0→90→0 nod.
- Stepped char opacity/blur jitter during flip.
- Tiny grid jitter + chassis busy glow while `isBroadcasting`.
- Honor `prefers-reduced-motion` by killing scramble animations.

## Hydration

- Prefer deterministic SSR default for the initial board when possible.
- If randomness is intentional for the first paint, keep random init and put `suppressHydrationWarning` on the **tile grid container** and any live status that echoes the random message.
- Avoid `useEffect` + `setState` solely to dodge hydration — fails `react-hooks/set-state-in-effect` and still flashes.
- Format clocks with explicit `getHours()` / `getMinutes()` pad, not `toLocaleTimeString()`.

## Inspect Classnames

Repeated tiles/presets/history items need base + unique last classname, e.g.:

- `vestaboard-tile vestaboard-tile-0`
- `vestaboard-preset-chip vestaboard-preset-ship`
- `vestaboard-history-item vestaboard-history-item-0`

Unique classname last so inspect preferredSelector stays unique.

## Theme Tokens

Template chrome may define `--board` (or similar layout vars) alongside required shadcn tokens.
Do **not** add those to `REQUIRED_THEME_TOKENS`.
When create-custom-template CSS includes them, ensure `IGNORED_CUSTOM_THEME_TOKENS` in `lib/themes/registry.ts` includes at least `--destructive-foreground` and `--board`, or creation fails with “unsupported token”.
Ignored vars are dropped from the stored theme token maps; durable board styling still lives in template `globals.css`.

## CSS Contrast

Chassis and board are hardcoded dark gradients. Nested badges/labels must use explicit light oklch colors — never bare `var(--muted-foreground)` on the chassis rails.

## Verification

```bash
npm --prefix templates/vestaboard run typecheck
npx eslint templates/vestaboard/app/page.tsx templates/vestaboard/components/vestaboard-theme-toggle.tsx --max-warnings 0
```

Creative UI polish is user-judged in preview; run lint/typecheck before commit. Preview the Send/Shuffle path specifically for disorder amount.