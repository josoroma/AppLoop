# Marp / Marpit theme CSS pitfalls

## Symptom

```
GET /api/presentations/.../preview 500
Marpit theme CSS requires @theme meta.
```

Cause: optional `theme.css` in workspace lacked `/* @theme name */` while still passed to `marp.themeSet.add()`.

## Rules

1. Every **external theme pack** registered with `themeSet.add` must include `@theme <name>` meta.
2. Front-matter `style: |` blocks are **local overrides**, not theme packs — do not rely on `@theme` comments inside them.
3. Prefer `theme: default` + `style:` for Simple 3 slides; keep `theme.css` valid for optional overrides.
4. Server path:
   - `loadOptionalThemeCss(workspace)`
   - `ensureMarpitThemeMeta(css)` if missing meta
   - `themeSet.add(css)` in try/catch
   - Never force custom theme as default when deck requests `theme: default`

## Blueprint starter

```css
/* @theme apploop-presentation */

section {
  background: #000000;
  color: #ffffff;
}
```

## TS source gotcha (parse-breaking)

Do **not** put a raw `/*` inside a TS template literal when building inject strings — parsers treat it as a real block comment and can destroy the module:

```ts
// BAD
return `/* @theme ${themeName} */\n${css}\n`;

// GOOD
const open = "/" + "*";
const close = "*" + "/";
return `${open} @theme ${themeName} ${close}\n${css}\n`;
```

`ensureMarpitThemeMeta` must use the concat form. Covered in `tests/presentation-marp.test.ts`.
