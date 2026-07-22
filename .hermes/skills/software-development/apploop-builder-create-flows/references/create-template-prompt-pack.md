# Create-template paste packs (user preference)

When Joso asks for a prompt to create a template, deliver a **paste-ready pack**, not only free prose:

1. **Template name**
2. **Short description** (1–2 lines, Product/library tone)
3. **Template prompt** (long Hermes authoring brief)

## Always bake into the Template prompt

- Next.js App Router + React 19 + TypeScript; preserve AppLoop template contract:
  - `package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
  - `components/inspector-provider.tsx`, `components/theme-provider.tsx`
  - body `className="template-<id>"`
- Shared/base classnames **plus unique human-readable LAST classname** (`preferredSelector`)
- Client-only WebGL/R3F/GSAP; no `Math.random`/`Date` mismatches in SSR text without intentional Hydration strategy
- Dark neon/canvas hero: nested text/controls need **explicit high-contrast colors**, not muted theme tokens on dark gradients
- Do not edit AppLoop builder source or sibling templates
- Optional Theme CSS note: keep full required tokens; put chassis/layout vars in root `IGNORED_CUSTOM_THEME_TOKENS` rather than required

## Heavy briefs

Multi-route + R3F + custom GLSL platforms (e.g. “MCP-2099”) often need **longer create waits** (`runProjectOnce`). Offer a safer **slice 1 / slice 2** prompt path when success risk is high:

- Slice 1: loader + hero + nav shell
- Slice 2: remaining IA pages after template-edit redirect

## Ops context for the user (optional one-liner)

Create Template = gateway authoring → `openTemplateForEditing` → `/projects/:id`.  
Create Project = local only; no Hermes during create.
