# Template Visual Identities

Use this reference when the user says templates look generic/default or asks to restore a template's distinct visual identity.

## Global rules

- Only `templates/default` should look like the generic/default app. Specialty templates must preserve their own visual identities.
- Before syncing a generated workspace or editing a template, verify `app/layout.tsx` contains the matching body class (`template-ai-engineer-cv`, `template-deep-research-paper`, `template-luminous-rings`, etc.). A project name or slug is not proof of template identity.
- If a generated project named like a specialty template looks default, first inspect `app/layout.tsx` body classname and `app/page.tsx` component marker before tweaking colors.
- Do not let selectable theme tokens homogenize specialty templates. Hardcoded visual effects are acceptable when they define the template identity.
- Template theme providers should use template-specific localStorage keys so one template's light/dark setting does not bleed into another.

## AI Engineer CV: dark v0/SaaS hero feel

For `templates/ai-engineer-cv`, the desired direction is a dark, high-contrast SaaS hero / product-launch feel inspired by modern v0-style pages, without copying brand text.

Key traits:

- Force dark-first behavior (`<html className="dark">`, template-specific theme storage key defaulting to `dark`, e.g. `apploop-ai-engineer-cv-theme`).
- Black/near-black base background with purple/violet radial glow auras.
- Subtle square grid overlay faded toward the lower page.
- Glass cards with translucent white borders, backdrop blur, and soft shadows.
- Large gradient headline/name treatment with white → lavender → purple.
- Pill/badge microcopy in a bordered translucent capsule.
- Animated glow orbs and small card-rise entrance animations, with `prefers-reduced-motion` fallback.
- Nested text inside dark containers must use explicit high-contrast hardcoded colors or white mixes, not bare theme tokens.

Good CSS patterns:

```css
.cv-page-layout {
  background:
    radial-gradient(circle at 75% 18%, oklch(0.42 0.24 292 / 30%), transparent 28rem),
    linear-gradient(180deg, #08080d 0%, #050507 42%, #030304 100%);
}

.cv-main-section {
  border: 1px solid oklch(1 0 0 / 8%);
  background: linear-gradient(180deg, oklch(1 0 0 / 6%), oklch(1 0 0 / 2.5%));
  backdrop-filter: blur(18px);
}
```

## Deep Research Paper: light scientific research structure

For `templates/deep-research-paper`, the desired direction is light-mode academic/scientific structure, not dark SaaS.

Key traits:

- Force light-first behavior via a template-specific theme storage key defaulting to `light`, e.g. `apploop-deep-research-paper-theme`.
- Warm paper background (`#fffdf7`/cream) with subtle grid/dot research texture.
- Document-like central article with paper border, rounded corners, and soft shadow.
- Metadata strip at the top (DOI / draft / evidence map feel).
- Strong serif title, readable abstract, structured sections, citation/provenance panel.
- Finding cards with accent bars, subtle hover lift, and scientific muted colors.
- Section counters (01, 02, 03) via CSS counters for research structure.

Good CSS patterns:

```css
.paper-shell {
  background:
    radial-gradient(circle at 12% 8%, oklch(0.83 0.075 204 / 28%), transparent 22rem),
    linear-gradient(180deg, #fffdf7, #f5f0e6 72%, #eee7d8);
}

.paper-content-section::before {
  counter-increment: research-section;
  content: counter(research-section, decimal-leading-zero);
}
```

## Vestaboard: physical chaotic split-flap chassis

For `templates/vestaboard`, the desired direction is a mechanical split-flap studio, not a polished form/chat mock.

Key traits:

- Dark metal chassis + ambient stage glow + 22×6 lit/unlit tiles.
- Messages auto-center across rows; blank tiles stay dark/unlit.
- Word transitions must look disordered: multi-wave random glyph scrambles, jittered flip delays, collateral neighbor flips, then settle. User saying “lacks more disorder” means bump scramble intensity, not polish CSS.
- Keep `template-vestaboard` body classname and template-specific theme storage if present.
- Nested chassis text uses hardcoded light oklch, never bare muted theme tokens.
- Create-template CSS may include `--board`; keep it in `IGNORED_CUSTOM_THEME_TOKENS`, not required tokens.

See `generated-app-standards/references/vestaboard-template.md` for implementation mechanics.

## Luminous Rings: colored spinning laser rings

For `templates/luminous-rings`, the target is: colored lasers spinning in circles, forming luminous concentric rings in blue, pink, purple, and white against a dark background.

Key traits:

- Prefer native WebGL shader/no heavy deps for the main effect.
- The visible page must show centered/layered concentric rings, rotating arc segments, and a deep black/blue background.
- Colors must include distinct blue, pink, purple, and white laser lines.
- Add radial/spoke laser beams only as supporting motion; the concentric rings are the primary identity.
- Text/cards may sit over the effect, but must not hide the core ring identity.
- Verify visually with browser screenshot/vision, not just curl/typecheck, because the requirement is primarily visual.

Good shader/CSS patterns:

```glsl
float baseRing = fullRing(center, radius, width * 2.25);
float blueArc = ringLaser(slow, radius, width, phase, arcLength);
float pinkArc = ringLaser(fast, radius + 0.009, width * 1.1, -phase * 0.95, arcLength * 0.86);
float purpleArc = ringLaser(counter, radius + 0.018, width * 1.28, phase * 1.17 + 1.9, arcLength * 0.72);
float whiteArc = ringLaser(whiteSpin, radius + 0.026, width * 0.82, -phase * 1.34 + 2.8, arcLength * 0.44);
```

```css
.homepage-title::after {
  background: linear-gradient(90deg, #24a3ff, #ff2ca8, #8c42ff, white);
  box-shadow: 0 0 28px #8c42ff;
}
```
