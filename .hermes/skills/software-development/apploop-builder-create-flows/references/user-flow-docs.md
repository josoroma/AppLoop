# AppLoop user-flow docs contract

Canonical docs (keep in sync when create/edit flows change):

| Flow | Doc |
|------|-----|
| Create template | `docs/README-USER-FLOW-TEMPLATES.md` |
| Create project | `docs/README-USER-FLOW-PROJECTS.md` |
| Inspect → prompt → restore/edit | `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md` |

## Required sections

Every user-flow doc should include:

1. **TOC** at top
2. Click-path walkthrough (URLs + UI labels)
3. **Wait path** — local vs Hermes gateway, what the user is blocked on
4. **Success landing** — redirect and/or where streamed response appears
5. **Actions / APIs** — server actions, `POST /api/chat`, gateway methods, postMessage contracts
6. **DB tables** — QUERY vs INSERT/UPDATE/DELETE and why
7. **Main files** — UI, actions, repository, Hermes, FS helpers
8. Diagrams when the control plane / data plane split matters

## Create latency mental model (must document)

```text
Create Project:
  Browser form → createProjectAction
  → local DB bundle + fs.cp template + optional theme + git init
  → redirect /projects/:id
  Hermes: ONLY after later chat

Create Template:
  Browser form → createCustomTemplateAction
  → local FS scaffold + project_templates status=generating
  → Hermes runProjectOnce (template-authoring)
  → status=ready → openTemplateForEditing
  → redirect /projects/:id  (workspace = templates/<id>)
```

Do not tell users “creating a project talks to Hermes” during the create overlay. That is false for create-project and true for create-template.

## Edit/inspect mental model (summary)

```text
Inspect → preferredSelector = last classname
Send → createFileSnapshot + createVisualSelectionPrompt + POST /api/chat
Gateway → streamProjectRun (mode project-edit | template-edit)
UI success → Hermes bubble + activity cards + preview HMR/reload
Restore → git revert + truncate chat UI/DB from clicked prompt + runtime restart
Edit → Restore + prefill short prompt (prefer raw_user_prompt)
```

Detail for the inspect path lives in `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md` and skills `chat-checkpoints` + `visual-selector`.
