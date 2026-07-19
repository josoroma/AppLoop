# Template Selection And Workspace Integrity

Use this reference when a generated project is named like one template but renders as another, or when multiple templates suddenly look like the default app.

## Failure Signal

A project named `AI Engineer CV`, `Deep Research Paper`, or `Luminous Rings` renders the default starter app (`Ready for your first...`, `AppLoop`, default nav). This is not a theme-only issue if the generated workspace contains:

```bash
grep "template-" .apploop/projects/<slug>/app/layout.tsx
# Wrong: template-default
# Expected examples:
#   template-ai-engineer-cv
#   template-deep-research-paper
#   template-luminous-rings
```

Also check the page marker:

```bash
grep "data-builder-component" .apploop/projects/<slug>/app/page.tsx | head
```

If it says `HomePage` / `default-home-page`, the workspace was copied from the default template.

## Root Cause Pattern

Server-action forms can lose controlled radio selections if the submitted FormData does not carry the React state value. In AppLoop project creation, if `templateId` is missing, `createProjectAction()` falls back to `DEFAULT_PROJECT_TEMPLATE_ID`, creating a correctly named project with default-template files.

## Durable Fix

In the create-project form, submit explicit hidden inputs bound to React state as the single source of truth:

```tsx
<input name="templateId" type="hidden" value={selectedTemplateId} />
<input name="themeId" type="hidden" value={selectedThemeId} />
```

Keep the visible radio inputs controlled for UI state, but do not rely on them as the submitted values.

## Repair Existing Broken Workspaces

1. Stop any running dev server for the project preview port.
2. Remove the broken workspace folder.
3. Recopy from the matching source template, excluding transient folders:

```bash
rsync -a \
  --exclude node_modules --exclude .next --exclude .turbo \
  --exclude out --exclude dist --exclude logs \
  templates/<template-id>/ .apploop/projects/<slug>/
```

4. Install dependencies in the generated workspace.
5. Verify template identity:

```bash
grep "template-" .apploop/projects/<slug>/app/layout.tsx
npm --prefix .apploop/projects/<slug> run typecheck
```

6. Start the preview on the project `preview_port` and confirm HTTP 200.

## Theme Caveat

If the workspace body classname is correct but the visual style still looks generic, inspect `applyThemeToWorkspace()`: replacing `:root` and `.dark` token blocks with generic Luma tokens can flatten distinctive template palettes. In that case, fix theme/token design rather than recopying the template.