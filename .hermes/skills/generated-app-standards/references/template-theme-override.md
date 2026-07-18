# Template Theme Override from Reference Site

Use this workflow when overriding an AppLoop template's visual design (colors, effects, decorative elements) from a reference website.

## Step 1: Extract Design Tokens from Reference Site

Use `browser_navigate` to load the site, then `browser_console` with JavaScript to extract:

```javascript
// CSS custom properties (color palette, spacing, fonts)
const rootStyles = getComputedStyle(document.documentElement);
const vars = {};
for (let i = 0; i < rootStyles.length; i++) {
  const prop = rootStyles[i];
  if (prop.startsWith('--')) vars[prop] = rootStyles.getPropertyValue(prop).trim();
}

// All gradient backgrounds across the page
const gradients = [];
document.querySelectorAll('*').forEach(el => {
  const bg = getComputedStyle(el).backgroundImage;
  if (bg && bg !== 'none' && bg.includes('gradient')) {
    gradients.push({ tag: el.tagName, class: el.className, bg });
  }
});

// Structural info: hero HTML, body classes, decorative elements
return {
  vars,
  gradients: gradients.slice(0, 20),
  bodyClasses: document.body.className,
  heroHTML: document.querySelector('main section:first-of-type')?.outerHTML?.substring(0, 3000),
  hasGridPattern: !!document.querySelector('.absolute.inset-0.opacity-20'),
  glowEffects: document.querySelectorAll('[class*="blur-"]').length,
};
```

Key things to extract:
- **Color palette**: the `--color-*` and `--background`/`--foreground`/`--primary`/`--muted` CSS vars
- **Gradients**: all `linear-gradient`/`radial-gradient` uses — these define the accent colors
- **Decorative effects**: grid patterns (`background-image` with repeating lines), glow orbs (`blur-[120px]` + colored circles), glass effects (`backdrop-blur-sm`, `bg-white/5`)
- **Font**: the `--default-font-family` var
- **Animation**: any keyframe animations on decorative elements

## Step 2: Translate to Template CSS

Map the extracted tokens into the template's `globals.css`:

| Reference site token | Template destination |
|---|---|
| `--background` | `:root` → `--background` |
| `--foreground` | `:root` → `--foreground` |
| `--primary` (gradient equivalent) | `:root` → `--primary` (pick the midpoint oklch) |
| Gradient accent colors | Inline in `.cv-*` selectors as `oklch(...)` values |
| Grid pattern | `.cv-page-layout::before` pseudo-element |
| Glow orbs | `.cv-glow-orb-*` classes with `position: absolute`, `blur()`, `border-radius: 9999px` |
| Glass effects | `backdrop-filter: blur(8px)` + `oklch(1 0 0 / N%)` backgrounds |
| Text gradients | `background: linear-gradient(...); background-clip: text; -webkit-text-fill-color: transparent` |

### Color mapping for Indigo-Violet palette (the "blond" theme)

These are the specific oklch values extracted from the v0 blond reference:

```
indigo-400:  oklch(0.599 0.225 -64.449)   — light indigo (text gradients)
indigo-500:  oklch(0.483 0.383 -81.967)   — mid indigo (gradient start)
indigo-600:  oklch(0.384 0.526 -92.386)   — dark indigo (buttons, glow orbs)
purple-400:  oklch(0.637 0.476 -59.207)   — light purple (text gradients)
purple-500:  oklch(0.520 0.661 -78.232)   — mid purple (gradient end)
violet-600:  oklch(0.411 0.690 -91.995)   — dark violet (buttons, glow orbs)
background:  oklch(0.098 0.005 265)       — near-black with blue tint (#0a0a0a)
```

### Dark Container Nested Contrast

Follow the pattern from `generated-app-standards` → Dark Container Nested Contrast: ALL text/icon/border colors inside dark-gradient containers (sidebar, skill cards, profile header) MUST use explicit `oklch(...)` or `color-mix(in oklch, white N%, ...)` values. Never use `var(--muted-foreground)` in dark containers.

## Step 3: Add Decorative DOM Elements

If the reference site has glow orbs or other decorative elements, add them as empty `<div>`s in `page.tsx` inside the main layout container:

```tsx
<main className="cv-page-layout" ...>
  <div className="cv-glow-orb-tl" aria-hidden="true" />
  <div className="cv-glow-orb-br" aria-hidden="true" />
  <div className="cv-glow-orb-cr" aria-hidden="true" />
  {/* ... rest of the page ... */}
</main>
```

These are purely decorative — use `aria-hidden="true"` and `pointer-events: none` in CSS.

## Step 4: Update Default Theme Mode

If the reference design is dark-first, update `components/theme-provider.tsx`:

```tsx
const [mode, setMode] = useState<ThemeMode>("dark");  // was "light"
```

## Step 5: Build and Verify

```bash
cd templates/<id> && npm run build
```

Verify the build succeeds and check that the compiled CSS contains the expected rules (gradients, grid patterns, blur effects).

If there's an active `.apploop/projects/<slug>` copy, sync changes back:
```bash
cp templates/<id>/app/globals.css .apploop/projects/<slug>/app/globals.css
cp templates/<id>/app/page.tsx .apploop/projects/<slug>/app/page.tsx
cp templates/<id>/components/theme-provider.tsx .apploop/projects/<slug>/components/theme-provider.tsx
```

## Pitfalls

1. **Extracting the wrong part of the page**: Reference sites often have different themes in different sections (e.g., dark hero + light body). Inspect the specific section the user pointed to, not the whole site. Use `document.querySelector('main section:first-of-type')` to target the right area.

2. **CSS var values are not portable**: The reference site's `--background: lab(100% 0 0)` means white in that site's color space, but the template uses `oklch()`. Convert manually — don't copy-paste raw var values.

3. **Missing glow orb animations**: Glow orbs need both the CSS (`position: absolute`, `border-radius: 9999px`, `filter: blur()`) AND a keyframe animation (`@keyframes cv-orb-float`) to look polished. Without animation, they look like static misplaced blobs.