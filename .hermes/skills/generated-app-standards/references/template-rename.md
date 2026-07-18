# Template Rename Workflow

When renaming or restructuring a template, follow this checklist. Every step is required — missing one leaves stale references.

## Files to update (in order)

### 1. Rename the folder
```bash
mv templates/<old-name>/ templates/<new-name>/
```

### 2. Update template registry
**File**: `lib/projects/templates.ts`
- `id`, `name`, `description`, `templatePath` for the renamed template
- Also update `DEFAULT_PROJECT_TEMPLATE_ID` if renaming the default template

### 3. Update default template path (if default was renamed)
**File**: `lib/projects/files.ts`
- `GENERATED_APP_TEMPLATE_PATH` constant

### 4. Update the template's own body classname
**File**: `templates/<new-name>/app/layout.tsx`
- The `<body>` element carries a `template-{id}` classname that must match the new template ID

### 5. Update all inspector-provider.tsx files
Every template has a shared set of template classname identifiers in its `inspector-provider.tsx`. Update ALL of them:
```
templates/<new-name>/components/inspector-provider.tsx
templates/default/components/inspector-provider.tsx
templates/admin-luma/components/inspector-provider.tsx
templates/ai-engineer-cv/components/inspector-provider.tsx
templates/deep-research-paper/components/inspector-provider.tsx
templates/solar-system/components/inspector-provider.tsx
```

### 6. Update tests
- `tests/project-management.test.ts` — template ID references in test arrays
- `tests/project-files.test.ts` — if default template path changed
- `tests/generated-code-standards.test.ts` — if default template path changed

### 7. Update .hermes assets
Search for all references with `search_files(pattern="<old-name>", path=".hermes")` and update:

- `.hermes/skills/generated-app-standards/SKILL.md` — template classname mapping, diff/cp examples, grep comments
- `.hermes/skills/visual-selector/SKILL.md` — template classname table, pitfalls
- `.hermes/skills/project-runtime/SKILL.md` — copy commands, template lists in prevention notes
- `.hermes/skills/theme-system/SKILL.md` — template ID in example code
- `.hermes/skills/frontend-design/SKILL.md` — template classname list
- `.hermes/hooks/generated-code-review/HOOK.md` — template classname list
- `.hermes/agents/nextjs-implementer.md` — template classname preservation rule

### 8. Update docs
- `README.md` — template table
- `CLAUDE.md` — template path references
- `docs/SCREENSHOTS.md` — template path references

### 9. Verify
```bash
# Confirm zero remaining references to old name
search_files(pattern="<old-name>", path=".")

npm run typecheck
npm test -- --run tests/project-files.test.ts tests/generated-code-standards.test.ts tests/project-management.test.ts
```

## Pitfalls

- **Forgetting the body classname**: The template's `layout.tsx` `<body>` carries `template-{id}`. If you rename the folder but not the body classname, inspect mode breaks for that template.
- **Missing an inspector-provider**: All 6 template `inspector-provider.tsx` files share a list of template classnames. Missing one causes inconsistent inspect behavior.
- **Skipping .hermes agents/hooks**: The `.hermes/agents/nextjs-implementer.md` agent and `.hermes/hooks/generated-code-review/HOOK.md` hook both reference template classnames by name. Forgetting them means agent-generated code uses the wrong body classname.
- **Test timeouts**: `tests/project-management.test.ts` creates workspaces from templates which runs `npm install`. If the timeout is tight (5s default), the test may time out — this is environmental, not caused by the rename.