# Solar System Scene Physics And Visual Scale

Use this reference when editing the `solar-system` template or an active generated project copied from it.

## Problem Signals

- Planets appear to pass inside or through the Sun.
- Gas giants dominate the viewport or clip into the camera foreground.
- Inner planets are visually stuck to the Sun.
- Sun has a label but cannot open the same info card as planets.
- Scene feels toy-like: flat lighting, no orbital inclinations, no Saturn ring, or random initial positions that produce bad overlap.

## Durable Design Rules

- Use deterministic starting angles for planets, not `Math.random()`, so screenshots and QA are reproducible.
- Preserve real orbital order and relative meaning while using a compressed visual scale; exact astronomical scale is impossible in a single viewport.
- Guarantee clearance: `orbitRadius - planet.size` must be greater than `SUN_RADIUS + glowPadding`. In practice, inner Mercury should start several visual units away from the Sun, not near its surface.
- Compress planet radii aggressively: terrestrial planets remain small; gas giants are larger but must not be so large that their spheres overlap or dominate the viewport.
- Add Sun interactivity through the same `onSelectPlanet(PlanetInfo)` path as planets. The Sun info card should use role-oriented copy instead of “Distance from Sun”.
- Prefer orbital inclinations and axial tilts for realism; keep orbit rings tilted consistently with planet motion.
- Add Saturn rings when Saturn is visible, and keep ring size tied to Saturn’s visual radius.
- Use low ambient light, strong warm point light at the Sun, and a subtle hemisphere fill to improve realism without flattening the scene.
- Camera should be far enough to include the full inner system and gas giants without clipping (`position` and `far` plane must match the largest orbit radius).

## Verification

1. Run the template and generated workspace typechecks.
2. Start the preview directly at the project preview port.
3. Click “Begin Exploration”.
4. Confirm labels include `Sun` and every planet.
5. Visually confirm no planet sphere intersects the Sun or another planet in the default view.
6. Click the Sun and at least one planet to confirm the info card opens for both.
7. Confirm HTTP `/` returns 200 and no module resolution errors are present.
