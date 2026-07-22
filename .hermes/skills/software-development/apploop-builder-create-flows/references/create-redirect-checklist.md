# Create → Builder Edit Redirect Checklist

## Project create

Action: `createProjectAction` in `lib/projects/actions.ts`

1. Parse name / templateId / themeId
2. Resolve template (built-in or ready custom)
3. `projectService.createProject`
4. `createProjectWorkspace`
5. `rememberLastOpenedProject`
6. `revalidatePath("/projects")`
7. **`redirect(`/projects/${project.project.id}`)`**

## Template create

Action: `createCustomTemplateAction` in `lib/projects/actions.ts`

1. Parse name / description / prompt / themeCss
2. `createCustomTemplate(repository, …)` → Hermes authoring until `ready`
3. **`const { projectId } = await openTemplateForEditing(repository, template.id)`**
4. `revalidatePath("/projects")` + `revalidatePath("/templates")`
5. **`redirect(`/projects/${projectId}`)`**

Incomplete if Hermes succeeds but the user stays on `/templates` or `/templates/new`.

## Builder project for templates

`openTemplateForEditing` reuses an active project already bound to `templates/<id>` or creates a new bundle with:

- `workspacePath` = absolute template root
- name like `Template: <template name>`
- preview port allocated from both project + runtime ports

Edit is **in place** on the template path (no clone). Clone is a separate actions path.