# Style Persistence Format

How inspect-selected element styles are persisted into Marp `deck.md`.

## Dual Persistence Strategy

Each element writes styles **two ways**:

### 1. Inline `style=""` on wrapper span (RELIABLE)

```html
<span class="apploop-el-b4b86e0839" style="text-align: center; left: 13.68%; top: 62.72%; position: absolute; z-index: 3;">
  A short Marp starter for AppLoop Presentations.
</span>
```

This is the primary path because Marpit SVG scoping makes class-only CSS rules fragile (`section .class` becomes `section section .class` and never matches). Inline styles survive Marp's HTML processing and always apply.

### 2. Managed CSS block in front-matter (BACKUP)

```markdown
style: |
  /* @apploop-inspect-styles */
  /* position context for dragged/absolute inspect nodes */
  section { position: relative; }
  .apploop-el-b4b86e0839 { text-align: center; left: 13.68%; top: 62.72%; position: absolute; z-index: 3; }
  .apploop-el-bd269db0ff { text-align: center; }
  /* @apploop-inspect-styles-end */
```

This is secondary — it serves as a batch-edit surface and keeps previous styles visible in the markdown source. It is auto-pruned: orphaned classes (no longer referenced in body) are removed on each save.

## Stable Identity

Class names are derived from `SHA1(slide_index | normalized_text)`:
```ts
const hash = createHash("sha1").update(`${slide}|${normalizedText}`).digest("hex").slice(0, 10);
return `apploop-el-${hash}`;
```

**Do NOT hash tag or CSS path** — after save, the DOM node changes (`p` → `span.apploop-el-…`). Text + slide index is the only stable identity across reloads.

## Merge on Re-save

When `applyPresentationElementStylesToMarkdown` processes a target:
1. Look up existing style via `entryMap.get(className)` (from parsed managed CSS block)
2. Merge: `{ ...previous, ...filtered(incoming) }` — only non-empty string values from incoming overwrite
3. Result: partial updates (drag-only, color-only) do **not** wipe earlier properties

```ts
const previous = entryMap.get(className) ?? {};
const parsedStyle = PresentationElementStyleSchema.parse({
  ...previous,
  ...Object.fromEntries(
    Object.entries(incoming).filter(([, v]) => typeof v === "string" && v.trim().length > 0),
  ),
});
```

## Wrapper Management

Before re-wrapping:
1. `stripAllApploopWrappersAroundText()` peels ALL nested apploop spans around the target text (up to 6 levels)
2. `stripExistingWrapper()` removes the specific class if present
3. `makeWrapperOpenTag()` generates `<span class="...">` or `<span class="..." style="...">` depending on whether there are style declarations

This prevents nested wrapper accumulation across multiple saves.

## Managed CSS Block Format

- Delimiters: `/* @apploop-inspect-styles */` and `/* @apploop-inspect-styles-end */`
- Rules: no section prefix (Marpit already scopes); use `.classname { ... }`
- Always includes: `section { position: relative; }` for absolute positioning context
- Auto-cleaned: unreferenced classes removed; empty block (no rules) → block removed entirely
- Inserted: inside front-matter `style: |` block, before closing `---` fence

## Marp Renderer Requirements

- Renderer must use `html: true` — otherwise `<span>` wrappers are stripped
- `styleToInlineAttribute()` escapes `&` → `&amp;` and `"` → `&quot;` for valid HTML attributes
- CSS rules in managed block must use style-property names (no kebab→camelCase in markdown)

## Anti-patterns

- **Don't** prefix rules with `section .classname` (Marpit doubles it)
- **Don't** rely on class-only CSS for position persistence
- **Don't** hash tag or path in class names
- **Don't** apply without first stripping existing wrappers (causes nested accumulation)
