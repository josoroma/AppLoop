# Per-Slide Background Color Pattern

Full implementation pattern for per-slide background color picker in the AppLoop presentation builder.

## Storage format

Two mechanisms work together in `deck.md`:

### 1. Front matter `slide-bg-N` keys
```yaml
---
marp: true
theme: default
slide-bg-1: "ef4444"
slide-bg-2: "3b82f6"
slide-bg-3: "000000"
---
```

These are parsed by `parseSlideBackgrounds()` on every `loadSlides()` call.

### 2. Per-slide `<!-- _class: slide-bg-N -->` directives
```markdown
<!-- _class: slide-bg-1 -->
# My title
Some content...

---

<!-- _class: slide-bg-2 -->
## Slide two
...
```

Applied by `injectSlideClassDirectives()` during Save. These tell Marp's CSS to apply the corresponding background color rule.

## Color picker UI

```tsx
// In the editor header:
<label className="flex items-center gap-1.5 cursor-pointer" title="Slide background color">
  <span className="text-[11px] text-zinc-400">BG</span>
  <input
    type="color"
    value={activeBackground}
    onChange={(e) => {
      const updated = [...slideBackgrounds];
      updated[activeSlide - 1] = e.target.value;
      setSlideBackgrounds(updated);
      setStatus("Background updated · Save to persist");
    }}
    className="h-7 w-7 cursor-pointer rounded border-0 p-0 bg-transparent"
  />
</label>
```

## Filmstrip reflection

```tsx
// Each filmstrip card container:
const bg = slideBackgrounds[s.index - 1] ?? "#000000";
<div className="relative aspect-video ..." style={{ background: bg }}>
  <iframe src={`/api/presentations/${presentationId}/preview?slide=${s.index}&_t=${previewKey}`} />
</div>
```

The iframe also renders the correct background via Marp's CSS after Save updates the front matter.

## Save integration

During `handleSave()`:
```ts
nextMarkdown = injectSlideClassDirectives(nextMarkdown);
const parts = splitMarpDocument(nextMarkdown);
const fmWithBg = injectSlideBackgroundsIntoFrontMatter(parts.frontMatter, slideBackgrounds);
nextMarkdown = [fmWithBg, "---\n", parts.slides.join("\n\n---\n\n"), ""].join("\n");
```