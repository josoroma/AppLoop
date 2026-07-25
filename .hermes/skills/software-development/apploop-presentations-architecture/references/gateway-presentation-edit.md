# presentation-edit gateway branch

## Trigger

`lib/hermes/client.ts` → `createGatewayInstructions(request)` when:

```ts
bundle.projectContext.mode === "presentation-edit"
```

## Instruction payload must include

- Role: Marp presentation builder (not Next project builder)
- `Presentation ID`, `workspacePath`, `sourceFile`, `themeFile`
- Isolation: only workspacePath writable
- Marp rules: front matter, `---` separators, Simple 3-slides length
- Bundle paths: presentation-builder agent, marp-builder skills, presentation-scope-guard, /presentation-build
- Explicit forbid: npm, Next scaffold, projects/, templates/, presentations-templates blueprints
- **Omit** unique-last-classname / inspect contract (project-only)

## Assembly

```ts
createPresentationAgentBundle({
  projectId: presentationId, // Hermes client field name
  presentationId,
  workspacePath,
  sourceFile: "deck.md",
  packageInstallPolicy: "never",
  validationDepth: "quick",
  mode: "presentation-edit",
  ...
})
```

Chat entry: `app/api/presentations/chat/route.ts` (not `/api/chat`).

## Type unions

Before referencing new skill/command/hook ids, extend:

- `lib/hermes/skills.ts` — `marp-presentations`, bundle id `marp-builder`
- `lib/hermes/commands.ts` — `presentation-build`
- `lib/hermes/hooks.ts` — `presentation-scope-guard`
