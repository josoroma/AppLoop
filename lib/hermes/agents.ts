import path from "node:path";
import type { ProjectSettings } from "@/lib/db/schema";
import { MARP_BUILDER_COMMANDS, UI_BUILDER_COMMANDS, type HermesCommandDefinition } from "@/lib/hermes/commands";
import { MARP_BUILDER_HOOKS, UI_BUILDER_HOOKS, type HermesHookDefinition } from "@/lib/hermes/hooks";
import { MARP_BUILDER_SKILL_BUNDLE, UI_BUILDER_SKILL_BUNDLE, type HermesSkillBundleDefinition } from "@/lib/hermes/skills";

export type HermesAgentId =
  | "project-builder"
  | "presentation-builder"
  | "ui-architect"
  | "nextjs-implementer"
  | "validation-repair"
  | "security-auditor";

export type HermesAgentDefinition = {
  id: HermesAgentId;
  title: string;
  path: string;
  responsibilities: string[];
};

export type ProjectAgentContext = {
  projectId: string;
  workspacePath: string;
  selectedThemeId: string;
  packageInstallPolicy: ProjectSettings["packageInstallPolicy"];
  validationDepth: ProjectSettings["validationDepth"];
  defaultRoute: string;
  mode?: "project-edit" | "template-authoring" | "template-edit" | "presentation-edit";
  templateId?: string;
  templateName?: string;
  templatePath?: string;
  baseTemplateId?: string;
  presentationId?: string;
  sourceFile?: string;
  themeFile?: string;
};

export type ProjectAgentBundle = {
  orchestrator: HermesAgentDefinition;
  delegates: HermesAgentDefinition[];
  projectContext: ProjectAgentContext;
  skillBundle: HermesSkillBundleDefinition;
  hooks: HermesHookDefinition[];
  commands: HermesCommandDefinition[];
  layoutValidationScript: "npm run hermes:validate" | "true";
  completionCriteria: string[];
  isolationRules: string[];
};

export const HERMES_AGENT_DIRECTORY = path.join(process.cwd(), ".hermes", "agents");

export const HERMES_AGENT_DEFINITIONS: Record<HermesAgentId, HermesAgentDefinition> = {
  "project-builder": {
    id: "project-builder",
    title: "Project Builder Orchestrator",
    path: ".hermes/agents/project-builder.md",
    responsibilities: ["resolve-project-context", "delegate-workflow", "enforce-completion-criteria"],
  },
  "presentation-builder": {
    id: "presentation-builder",
    title: "Presentation Builder Orchestrator",
    path: ".hermes/agents/presentation-builder.md",
    responsibilities: ["resolve-presentation-context", "edit-marp-markdown", "enforce-presentation-isolation"],
  },
  "ui-architect": {
    id: "ui-architect",
    title: "UI Architect",
    path: ".hermes/agents/ui-architect.md",
    responsibilities: ["theme-application", "semantic-layout", "accessibility"],
  },
  "nextjs-implementer": {
    id: "nextjs-implementer",
    title: "Next.js Implementer",
    path: ".hermes/agents/nextjs-implementer.md",
    responsibilities: ["template-code", "route-modules", "component-standards"],
  },
  "validation-repair": {
    id: "validation-repair",
    title: "Validation And Repair",
    path: ".hermes/agents/validation-repair.md",
    responsibilities: ["typecheck", "lint", "runtime-health", "bounded-repair"],
  },
  "security-auditor": {
    id: "security-auditor",
    title: "Security Auditor",
    path: ".hermes/agents/security-auditor.md",
    responsibilities: ["path-containment", "secret-safety", "dangerous-command-review", "iframe-boundaries"],
  },
};

export function createProjectAgentBundle(context: ProjectAgentContext): ProjectAgentBundle {
  if (context.mode === "presentation-edit") {
    return createPresentationAgentBundle(context);
  }

  return {
    orchestrator: HERMES_AGENT_DEFINITIONS["project-builder"],
    delegates: [
      HERMES_AGENT_DEFINITIONS["ui-architect"],
      HERMES_AGENT_DEFINITIONS["nextjs-implementer"],
      HERMES_AGENT_DEFINITIONS["validation-repair"],
      HERMES_AGENT_DEFINITIONS["security-auditor"],
    ],
    projectContext: context,
    skillBundle: UI_BUILDER_SKILL_BUNDLE,
    hooks: UI_BUILDER_HOOKS,
    commands: UI_BUILDER_COMMANDS,
    layoutValidationScript: "npm run hermes:validate",
    completionCriteria: [
      "implementation-complete",
      "typecheck-passed-or-bounded-failure-reported",
      "lint-passed-or-bounded-failure-reported",
      "runtime-health-checked-when-preview-affected",
      "generated-ui-elements-have-unique-human-readable-last-classnames",
      "repo-local-hermes-agents-skills-hooks-commands-used",
      "affected-files-reported",
      "rollback-snapshot-created-before-existing-file-edits",
      "dependency-policy-respected-before-package-changes",
    ],
    isolationRules:
      context.mode === "template-authoring" || context.mode === "template-edit"
        ? [
            "workspacePath is the only writable root for template authoring/editing",
            "template runs may modify only this exact templates/<id> workspace and must not modify AppLoop builder source files, .hermes assets, repo docs, package files, generated projects, or sibling templates",
            "the template must remain a standalone generated Next.js app with package.json, app/layout.tsx, app/page.tsx, app/globals.css, components/inspector-provider.tsx, and components/theme-provider.tsx",
            "the template body classname must be template-<templateId> and all user-visible UI must use inspectable classnames with unique human-readable last classnames",
          ]
        : [
            "workspacePath is the only writable root",
            "project-edit runs must never modify AppLoop source files, templates/, or sibling .apploop/projects/* workspaces",
            "a path under .apploop/projects is writable only when it is inside this run's exact workspacePath",
            "browser-provided paths, ports, process IDs, and Hermes session IDs are untrusted",
            "Hermes API keys stay server-side",
            "private model reasoning must not be rendered as activity",
            "source inspection is required before editing existing generated files",
            "new generated UI must keep shared/base classnames plus unique inspect-mode classnames",
          ],
  };
}

export function createPresentationAgentBundle(context: ProjectAgentContext): ProjectAgentBundle {
  const sourceFile = context.sourceFile ?? "deck.md";
  const themeFile = context.themeFile ?? "theme.css";

  return {
    orchestrator: HERMES_AGENT_DEFINITIONS["presentation-builder"],
    delegates: [HERMES_AGENT_DEFINITIONS["security-auditor"]],
    projectContext: {
      ...context,
      mode: "presentation-edit",
      sourceFile,
      themeFile,
      packageInstallPolicy: "never",
      validationDepth: "quick",
      defaultRoute: "/",
      selectedThemeId: context.selectedThemeId || "marp-default",
    },
    skillBundle: MARP_BUILDER_SKILL_BUNDLE,
    hooks: MARP_BUILDER_HOOKS,
    commands: MARP_BUILDER_COMMANDS,
    layoutValidationScript: "true",
    completionCriteria: [
      "presentation-markdown-updated",
      "marp-front-matter-valid",
      "workspace-isolation-respected",
      "no-package-installs",
      "affected-files-reported",
    ],
    isolationRules: [
      "workspacePath is the only writable root for presentation-edit",
      `primary source file is ${sourceFile}`,
      `optional theme file is ${themeFile}`,
      "do not modify AppLoop builder source, templates/, presentations-templates/, projects, sibling presentations, or .hermes assets",
      "do not scaffold Next.js apps or install packages",
      "browser-provided paths and session IDs are untrusted",
      "Hermes API keys stay server-side",
    ],
  };
}
