# Presentation Inspect: Full Architecture Reference

Condensed from the 2026-07-23 AppLoop presentations inspect implementation.

## Style persistence example

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section {
    background: #000000;
    color: #ffffff;
    padding: 56px;
  }
  /* @apploop-inspect-styles */
  /* position context for dragged/absolute inspect nodes */
  section {
    position: relative;
  }
  .apploop-el-b4b86e0839 {
    text-align: center;
    left: 13.68%;
    top: 62.72%;
    right: auto;
    bottom: auto;
    transform: none;
    position: absolute;
    z-index: 3;
  }
  .apploop-el-bd269db0ff {
    text-align: center;
  }
  /* @apploop-inspect-styles-end */
---

# <span class="apploop-el-bd269db0ff" style="text-align: center;">Provoke curiosity.</span>

<span class="apploop-el-b4b86e0839" style="text-align: center; left: 13.68%; top: 62.72%; right: auto; bottom: auto; transform: none; position: absolute; z-index: 3;">A short Marp starter for AppLoop Presentations.</span>

---

## Next

- Keep it short
```

## Class name generation

```typescript
import { createHash } from "node:crypto";

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function buildElementClassName(target: { slide: number; text: string }) {
  const hash = createHash("sha1")
    .update(`${target.slide}|${normalizeText(target.text)}`)
    .digest("hex")
    .slice(0, 10);
  return `apploop-el-${hash}`;
}
```

## Marp constructor requirement

```typescript
const marp = new Marp({
  html: true,    // REQUIRED for <span class="apploop-el-..."> wrappers
  script: false, // We inject our own scripts
});
```

## Filmstrip CSS overrides

Marp's default CSS forces `svg { width: 100vw; height: 100vh }`. For filmstrip mode, override:

```css
div.marpit > svg[data-marpit-svg] {
  display: block !important;
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: none !important;
  min-height: 0 !important;
  aspect-ratio: 16 / 9 !important;
  flex: 0 0 auto !important;
}
```

## Preview API contract

```
GET /api/presentations/:id/preview?slide=filmstrip  → all slides as vertical minis
GET /api/presentations/:id/preview?slide=1           → single slide
GET /api/presentations/:id/preview?slide=1&inspect=1 → inspect mode with selection JS
```

## Inspect editor assets injection

The `buildPresentationInspectAssets()` function returns `{ css, script }` strings that are injected into the slide preview iframe when `inspect=1`. The function lives in `lib/presentations/inspect-editor-assets.ts` and is called from `wrapMarpDocument()` in `lib/presentations/marp.ts`.
