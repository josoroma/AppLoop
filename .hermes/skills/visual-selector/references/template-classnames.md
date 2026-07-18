# Template Classname System

## Template identifiers on `<body>`

Each generated project carries exactly one template classname on the root `<body>` element:

| Template ID | Body classname |
|---|---|
| `default` | `template-default` |
| `admin-luma` | `template-admin-luma` |

Registered in `SEMANTIC_BOUNDARY_CLASS_NAMES` in `lib/visual-selector/types.ts`.
Inspect mode ancestry includes the body classname, so Hermes can identify which template
generated a page even when both templates use shared classnames like `dashboard-header`.

## Repeated element naming convention

Every repeated element (`.map()` rendered items) follows:

```
{shared-base} {shared-base} {unique-instance}
```

Examples:
- `metric-card summary-card metric-revenue`
- `metric-card summary-card metric-active-users`
- `panel-card activity-panel`
- `panel-card accent-panel health-panel`
- `site-nav-link site-nav-home`
- `admin-nav-link admin-nav-overview`

The unique instance classname is embedded in the data model:
```tsx
const metrics = [
  { label: "Revenue", value: "$128K", className: "metric-revenue" },
];
<article className={`metric-card summary-card ${metric.className}`}>
```

## How preferredSelector works

`createSelectionPayload` in `inspector-provider.tsx`:

1. Collects `classNames` from `element.classList`
2. Finds first semantic classname via `SEMANTIC_CLASS_NAMES.has(className)`
3. Gets the last classname in array (most specific / unique)
4. `preferredSelector` = semantic classname (if found) else last classname else empty

Example resolution:
- Element: `<article class="metric-card summary-card metric-revenue">`
- classNames: `["metric-card", "summary-card", "metric-revenue"]`
- semantic: `"metric-card"` (first in array matching SEMANTIC_CLASS_NAMES)
- last: `"metric-revenue"`
- preferredSelector: `.metric-card` (semantic wins)

**Critical**: The `preferredSelector` is used as the toggle key in `toggleSelectedElement()`.
If two elements produce the same key (e.g. both resolve to `.metric-card`), multi-select
breaks — clicking the second element toggles the first one off.

## When to add a classname to SEMANTIC_BOUNDARY_CLASS_NAMES

Add when:
- A classname is used as a unique per-instance identifier (e.g. `metric-revenue`)
- A classname identifies which template a page uses (`template-default`, `template-admin-luma`)
- A classname needs to be preferred over other classnames in inspect mode selectors

Don't add when:
- The classname is purely for CSS styling (Tailwind utilities like `bg-card`, `text-sm`)
- The classname is a generic shared boundary already covered (e.g. `dashboard-header`)
