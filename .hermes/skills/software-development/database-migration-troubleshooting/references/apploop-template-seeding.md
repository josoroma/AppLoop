# AppLoop Template Database Seeding

Use this when AppLoop's local builder DB needs starter projects for every built-in template and no dedicated seed script exists.

## Discovery Pattern

1. Run migrations first so the SQLite schema is current:
   ```bash
   npm run db:migrate
   ```
2. Locate the template registry and creation flow:
   - `lib/projects/templates.ts` lists `BUILT_IN_PROJECT_TEMPLATES` and default theme IDs.
   - `lib/projects/service.ts` shows the project/conversation/runtime/theme/settings bundle shape.
   - `lib/projects/files.ts` shows workspace copy behavior and transient folders to skip.
   - `drizzle.config.ts` / `lib/env/schema.ts` define the default DB URL and projects root.
3. Verify whether a seed script exists before inventing one. If none exists, use the existing schema/service conventions to seed local state.

## Safe Manual Seed Shape

For each built-in template, create one local project bundle:

- `projects`: name, unique slug, workspace path, reserved Hermes session ID, active conversation ID, theme ID, preview port, active status.
- `conversations`: main active conversation with the same reserved Hermes session ID.
- `runtimes`: stopped runtime with a unique preview port in `3100-3199` and `http://127.0.0.1:<port>` URL.
- `project_themes`: default template theme.
- `project_settings`: defaults (`ask`, `standard`, auto-start enabled, `/`).
- `builder_preferences`: optionally set `last_opened_project_id` to the last seeded project.

Copy template workspaces from `templates/<templatePath>` into `.apploop/projects/<slug>` while filtering transient top-level folders: `.next`, `.turbo`, `node_modules`, `out`, `dist`, `logs`. Initialize git in the copied workspace if possible, but treat git initialization failure as non-fatal to match `lib/projects/files.ts`.

## Verification

After seeding, query the joined project state instead of trusting the seed script output:

```sql
SELECT p.name, p.slug, p.theme_id, p.preview_port, r.status, r.preview_url, c.title
FROM projects p
LEFT JOIN runtimes r ON r.project_id = p.id
LEFT JOIN conversations c ON c.id = p.active_conversation_id
ORDER BY p.preview_port;
```

Also verify each seeded workspace has a `package.json`, and check `git status --short -- .apploop/builder.sqlite .apploop/projects` to confirm the seed only touched ignored/local state.

## Pitfalls

- Do not assume templates are represented by a separate `templates` database table; AppLoop currently keeps built-ins in code and stores generated projects in `projects`.
- Do not copy transient build output from source templates into generated workspaces.
- Keep preview ports unique and within the configured preview range.
- If a target workspace already exists without a matching DB row, stop and ask before deleting or overwriting it.