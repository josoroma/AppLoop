export type HermesSkillId =
  | "frontend-design"
  | "generated-app-standards"
  | "hermes-gateway"
  | "theme-system"
  | "project-runtime"
  | "visual-selector"
  | "security-review";

export type HermesSkillDefinition = {
  id: HermesSkillId;
  command: `/${HermesSkillId}`;
  title: string;
  path: string;
  capabilities: string[];
};

export type HermesSkillBundleId = "ui-builder";

export type HermesSkillBundleDefinition = {
  id: HermesSkillBundleId;
  command: `/${HermesSkillBundleId}`;
  title: string;
  path: string;
  skills: HermesSkillDefinition[];
  activationOrder: HermesSkillId[];
};

export const HERMES_SKILL_DEFINITIONS: Record<HermesSkillId, HermesSkillDefinition> = {
  "frontend-design": {
    id: "frontend-design",
    command: "/frontend-design",
    title: "Frontend Design",
    path: ".hermes/skills/frontend-design/SKILL.md",
    capabilities: ["layout-hierarchy", "responsive-rules", "accessibility", "shadcn-composition", "semantic-class-names"],
  },
  "generated-app-standards": {
    id: "generated-app-standards",
    command: "/generated-app-standards",
    title: "Generated App Standards",
    path: ".hermes/skills/generated-app-standards/SKILL.md",
    capabilities: ["formatting", "named-exports", "component-rules", "route-colocation", "schema-action-patterns", "unique-inspect-classnames"],
  },
  "hermes-gateway": {
    id: "hermes-gateway",
    command: "/hermes-gateway",
    title: "Hermes Gateway",
    path: ".hermes/skills/hermes-gateway/SKILL.md",
    capabilities: ["server-only-auth", "session-context", "agent-bundle-forwarding", "stream-normalization", "cancellation", "user-safe-errors"],
  },
  "theme-system": {
    id: "theme-system",
    command: "/theme-system",
    title: "Theme System",
    path: ".hermes/skills/theme-system/SKILL.md",
    capabilities: ["theme-registry", "light-dark-tokens", "token-application", "theme-preview", "rollback"],
  },
  "project-runtime": {
    id: "project-runtime",
    command: "/project-runtime",
    title: "Project Runtime",
    path: ".hermes/skills/project-runtime/SKILL.md",
    capabilities: ["runtime-commands", "log-inspection", "readiness-checks", "restart-conditions"],
  },
  "visual-selector": {
    id: "visual-selector",
    command: "/visual-selector",
    title: "Visual Selector",
    path: ".hermes/skills/visual-selector/SKILL.md",
    capabilities: ["selector-payload", "source-location", "boundary-limited-edits", "ambiguous-selector-handling", "stable-id-fallback"],
  },
  "security-review": {
    id: "security-review",
    command: "/security-review",
    title: "Security Review",
    path: ".hermes/skills/security-review/SKILL.md",
    capabilities: ["path-containment", "secret-exposure", "dangerous-command-review", "runtime-isolation", "iframe-boundaries"],
  },
};

export const UI_BUILDER_SKILL_ORDER: HermesSkillId[] = [
  "security-review",
  "hermes-gateway",
  "visual-selector",
  "theme-system",
  "frontend-design",
  "generated-app-standards",
  "project-runtime",
];

export const UI_BUILDER_SKILL_BUNDLE: HermesSkillBundleDefinition = {
  id: "ui-builder",
  command: "/ui-builder",
  title: "UI Builder",
  path: ".hermes/bundles/ui-builder/BUNDLE.md",
  skills: UI_BUILDER_SKILL_ORDER.map((skillId) => HERMES_SKILL_DEFINITIONS[skillId]),
  activationOrder: UI_BUILDER_SKILL_ORDER,
};