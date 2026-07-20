# AppLoop Custom Template Authoring

Use this when adding or revising AppLoop flows that create, list, edit, clone, delete, or prompt-edit reusable templates.

## Flow

1. The `/projects` page exposes `New template` alongside `New project` and links to the template library.
2. The user provides only:
   - template name
   - optional short description
   - a natural-language template brief
   - editable shadcn-compatible theme CSS containing `:root` and `.dark` token blocks
3. Do **not** ask for `Start from template` or `Default theme` in the create-template dialog. Internally use the `default` template as the scaffold and use the editable theme CSS as the custom template palette.
4. AppLoop creates a unique kebab-case template id from the name.
5. AppLoop copies `templates/default/` to `templates/<new-id>/`, excluding transient folders:
   - `.next`
   - `.turbo`
   - `node_modules`
   - `out`
   - `dist`
   - `logs`
6. AppLoop validates the editable CSS with the existing custom theme parser (`createCustomTheme`) and applies it to `templates/<new-id>/app/globals.css` before Hermes authors the template.
7. AppLoop writes a `project_templates` row with `status = 'generating'`.
8. AppLoop sends the prompt to Hermes with the repo-local AppLoop bundle:
   - `.hermes/agents/*`
   - `.hermes/bundles/ui-builder/BUNDLE.md`
   - `.hermes/skills/*`
   - `.hermes/hooks/*`
   - `.hermes/commands/*`
9. The Hermes agent bundle uses `mode: 'template-authoring'`, not normal project-edit mode.
10. Hermes may write only inside the exact new `templates/<new-id>/` workspace.
11. AppLoop verifies required files and `template-<new-id>` on `<body>` before marking the row `ready`.
12. Ready custom templates are merged with built-ins for the `New project` picker.

## Template Library / Navigation

Expose a template library route such as `/templates` and link to it from `/projects`.

The library should show built-in and custom templates with:

- display name
- description
- source path (`templates/<id>`)
- default theme id
- source/status (`built-in`, `ready`, `generating`, `failed`)

Management rules:

- Built-in templates can be edited or cloned but cannot be deleted from the UI.
- Custom templates can be edited, cloned, or deleted; deletion removes both the `project_templates` DB row and `templates/<custom-id>/` directory.
- Editing any template should open the existing `templates/<id>/` workspace in a builder-compatible template-edit session without cloning.
- Cloning any template should copy it to a new unique `templates/<clone-id>/`, stamp `template-<clone-id>` in `app/layout.tsx`, write a `project_templates` row, and leave it ready to edit, clone again, or select when creating projects.
- AppLoop should create or reuse a builder-compatible project/conversation/runtime row whose `workspace_path` points at the existing template path before opening the edit surface.

## Template Editing Surface

Template editing should reuse the same builder interface used for project editing (chat + preview + inspect mode), but the backing workspace is `templates/<template-id>` rather than `.apploop/projects/<slug>`.

Recommended implementation pattern:

1. User clicks `Edit` in `/templates`.
2. AppLoop resolves the selected template source path (`templates/<id>/`).
3. AppLoop creates or reuses a builder-compatible project/conversation/runtime record whose `workspace_path` points at that exact existing template path.
4. AppLoop redirects to the existing builder route for that record so the normal chat, preview, screenshot, inspect, checkpoint, and runtime UI can be reused.
5. `/api/chat` detects template workspaces with a path-under-`templates/` check and sends `mode: 'template-edit'` in the AppLoop agent bundle.

## Required Template Files

A generated reusable template must remain a standalone generated Next.js app with at least:

- `package.json`
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `components/inspector-provider.tsx`
- `components/theme-provider.tsx`

## Prompt Guardrails

For template-authoring and template-edit prompts, repeat these constraints in the Hermes instructions:

- Only the exact `templates/<id>/` path is writable.
- Do not modify AppLoop builder source, `.hermes` assets, repo docs, root package/config files, generated projects, or sibling templates.
- Keep `<body className="template-<id>">` in `app/layout.tsx`.
- Every user-visible UI element needs inspectable classnames: shared/base classnames plus a unique, human-readable classname written last.
- Keep the template copyable into `.apploop/projects/<slug>`.
- Include the editable theme CSS in the template-authoring prompt as already-applied context so Hermes preserves or intentionally extends the palette instead of overwriting it blindly.

Important distinction:

- Project-edit prompts are confined to `.apploop/projects/<active-project-slug>` and must not modify `templates/`.
- Template-edit prompts are confined to exactly one `templates/<template-id>` workspace and must not modify `.apploop/projects/` or any sibling template.

## Theme CSS Pattern

The create-template UI should show an editable textarea prefilled with canonical shadcn/Luma `:root` and `.dark` token blocks. On submit:

1. Read `themeCss` from the form.
2. Normalize before parsing: trim whitespace, strip optional Markdown fences such as ```css ... ```, strip block comments (`/* ... */`), and strip line comments (`// ...`). Users often paste theme CSS from chat/spec text; comments/fences should not trip the token-only parser.
3. Parse with `createCustomTheme(themeCss)` to enforce required tokens and block imports/URLs/remote assets.
4. Apply with `applyThemeToWorkspace(templateRoot, theme)` before sending Hermes the authoring prompt.
5. For projects created from custom templates, avoid applying a built-in theme over the copied template CSS when the selected template's default theme id is the custom template id.

## Schema Pattern

Use a DB table for custom templates instead of editing the built-in registry at runtime. The durable fields are:

- `id`
- `name`
- `description`
- `template_path`
- `default_theme_id`
- `source = 'custom'`
- `status = 'generating' | 'ready' | 'failed'`
- `base_template_id` (internal scaffold lineage; default is `default`)
- `source_prompt`
- optional `hermes_session_id`, `hermes_run_id`, `last_error`

The built-in registry remains source-controlled in `lib/projects/templates.ts`; the UI reads built-ins plus ready DB rows.

## Pagination Pattern

Projects and templates list pages should paginate server-side after fetching their current collections. Use page-size choices `5`, `10`, `15`, `50`, and `100`; default to `10`. Keep `page` and `pageSize` in query parameters (`archivedPage` can be separate for archived projects). Clamp invalid page/page-size values to safe defaults and clamp requested pages to the available page count.

## Runtime Port Pitfall For Template-Edit Records

Template-edit sessions create builder-compatible project/conversation/runtime rows whose workspace points at `templates/<id>`. Preview port allocation must reserve both:

- every existing `projects.preview_port`
- every existing `runtimes.port`

A stopped or stale runtime row can still reserve `runtimes.port` via the unique `runtimes_port_idx` even when no process is listening and even when its project has since moved to a different preview port. Allocating from `listAllocatedPreviewPorts()` alone can choose a port that collides at runtime insert time. Prefer `listProjectOverviews()` and collect both `overview.project.previewPort` and `overview.runtime?.port` before calling `allocatePreviewPort()`.

When creating multi-row project bundles, wrap the inserts in a cleanup/rollback pattern (or DB transaction where available). If inserting `runtimes` fails after `projects`/`conversations` were inserted, delete the just-created project row so the UI does not retain an orphan template-edit project.

## Verification

- `npm run typecheck` after changing server/UI template-authoring code.
- `npm test -- tests/project-management.test.ts` for registry/workspace behavior.
- `npm run lint`; unrelated existing warnings can remain if unchanged.
- `npm run build` when adding new routes or changing server/client boundaries.
- `git diff --check` after README or migration edits.
