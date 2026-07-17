import path from "node:path";
import type { ProjectSettings } from "@/lib/db/schema";
import { UI_BUILDER_COMMANDS, type HermesCommandDefinition } from "@/lib/hermes/commands";
import { UI_BUILDER_HOOKS, type HermesHookDefinition } from "@/lib/hermes/hooks";
import { UI_BUILDER_SKILL_BUNDLE, type HermesSkillBundleDefinition } from "@/lib/hermes/skills";

export type HermesAgentId =
  | "project-builder"
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
};

export type ProjectAgentBundle = {
  orchestrator: HermesAgentDefinition;
  delegates: HermesAgentDefinition[];
  projectContext: ProjectAgentContext;
  skillBundle: HermesSkillBundleDefinition;
  hooks: HermesHookDefinition[];
  commands: HermesCommandDefinition[];
  layoutValidationScript: "npm run hermes:validate";
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
    responsibilities: ["generated-nextjs-code", "route-modules", "component-standards"],
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
    isolationRules: [
      "workspacePath is the only writable root",
      "browser-provided paths, ports, process IDs, and Hermes session IDs are untrusted",
      "Hermes API keys stay server-side",
      "private model reasoning must not be rendered as activity",
      "source inspection is required before editing existing generated files",
      "new generated UI must keep shared/base classnames plus unique inspect-mode classnames",
    ],
  };
}