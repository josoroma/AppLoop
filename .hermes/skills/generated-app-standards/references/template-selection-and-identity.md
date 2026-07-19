# Template Selection And Generated Workspace Identity

Use this when a project name says one template (for example AI Engineer CV, Deep Research Paper, or Luminous Rings) but the preview looks like the default app.

## Core diagnosis

Do not start with theme tokens. First verify the generated workspace identity:

```bash
grep "template-" .apploop/projects/<slug>/app/layout.tsx
grep "data-builder-component" .apploop/projects/<slug>/app/page.tsx | head
```

Expected body classnames:

- `template-default` → default app
- `template-admin-luma` → Luma Admin
- `template-ai-engineer-cv` → AI Engineer CV
- `template-deep-research-paper` → Deep Research Paper
- `template-luminous-rings` → Luminous Rings
- `template-solar-system` → Solar System

If the body classname is `template-default`, the project is not themed wrong; it was copied from the default template.

## Durable create-dialog fix

Controlled radio inputs can fail to submit the intended value when server actions read `FormData`. Use one hidden input per selected state as the authoritative submitted value:

```tsx
<input name="templateId" type="hidden" value={selectedTemplateId} />
<input name="themeId" type="hidden" value={selectedThemeId} />
```

Then remove `name="templateId"` / `name="themeId"` from the controlled radio inputs so the form has exactly one source of truth. The radio `onChange` handlers should only update React state.

## Repair pattern for existing bad workspaces

1. Stop the stale runtime and kill any listener on the old/new preview ports.
2. Remove or move the bad generated workspace.
3. Recopy the matching template source into the exact DB `workspace_path`, excluding transients:
   - `node_modules`
   - `.next`
   - `.turbo`
   - `out`
   - `dist`
   - `logs`
4. Run `npm install` or `pnpm install` inside the generated workspace.
5. Run `npm run typecheck` in the generated workspace.
6. Reset stale runtime rows so `runtimes.port` and `preview_url` match `projects.preview_port`.
7. Start the preview and confirm `curl /` returns 200 and the HTML contains the expected `template-*` classname.

## Theme application pitfall

`applyThemeToWorkspace()` replaces only `:root` and `.dark` token blocks. It can flatten a template's palette if the template relies heavily on shared semantic variables, but it should not change component structure. If the page body class or `data-builder-component` is wrong, the problem is template selection/copy, not theme application.

## Runtime port pitfall

When a project preview shows the wrong app, check for stale runtime rows and stale Next listeners. The project row's `preview_port` is the authority for the current project. A stale `runtimes.port` from a previous server can make the iframe point at an unrelated preview.

## Registry and workspace integrity tests

Add/keep a regression test that the create-project registry matches the actual GitHub/local `templates/` directories. For AppLoop this should assert the registered ids exactly match:

```text
admin-luma
ai-engineer-cv
deep-research-paper
default
luminous-rings
solar-system
```

The test should also read each `templates/<id>/app/layout.tsx` and assert it contains `template-<id>`. This catches cases where a new template folder exists but is not wired into the create dialog registry, or the registry points to the wrong folder.

## Template-local theme state

Template `ThemeProvider` components should not all share one generic localStorage key like `apploop-template-theme`. A shared key can make a dark template hydrate into light mode because another template stored `light`, or make a light paper template hydrate into dark mode because a CV/admin template stored `dark`.

Use template-specific keys, for example:

- `apploop-ai-engineer-cv-theme` defaults to `dark`.
- `apploop-deep-research-paper-theme` defaults to `light`.
- `apploop-admin-theme` defaults to `dark`.

This is separate from CSS token application: a template can have correct `:root`/`.dark` tokens but still look wrong if hydration toggles the wrong class from shared state.