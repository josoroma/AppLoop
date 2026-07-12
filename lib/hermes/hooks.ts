export type HermesHookId = "project-scope-guard" | "generated-code-review" | "theme-integrity" | "preview-readiness";

export type HermesHookTrigger = "pre-tool-use" | "post-edit" | "before-completion";

export type HermesHookDefinition = {
  id: HermesHookId;
  title: string;
  path: string;
  trigger: HermesHookTrigger;
  inputs: string[];
  outputs: string[];
  enforcement: string[];
};

export const HERMES_HOOK_DEFINITIONS: Record<HermesHookId, HermesHookDefinition> = {
  "project-scope-guard": {
    id: "project-scope-guard",
    title: "Project Scope Guard",
    path: ".hermes/hooks/project-scope-guard/HOOK.md",
    trigger: "pre-tool-use",
    inputs: ["workspacePath", "operation", "targets"],
    outputs: ["allow", "block", "auditLog"],
    enforcement: ["normalize-paths", "resolve-symlinks", "block-traversal", "log-blocked-operations"],
  },
  "generated-code-review": {
    id: "generated-code-review",
    title: "Generated Code Review",
    path: ".hermes/hooks/generated-code-review/HOOK.md",
    trigger: "post-edit",
    inputs: ["workspacePath", "changedFiles", "diff"],
    outputs: ["allow", "block", "violations"],
    enforcement: [
      "default-export-check",
      "formatting-check",
      "import-path-check",
      "file-naming-check",
      "one-component-per-file",
      "component-file-match",
      "route-colocation-check",
      "schema-pattern-check",
      "action-pattern-check",
    ],
  },
  "theme-integrity": {
    id: "theme-integrity",
    title: "Theme Integrity",
    path: ".hermes/hooks/theme-integrity/HOOK.md",
    trigger: "post-edit",
    inputs: ["workspacePath", "selectedThemeId", "changedFiles"],
    outputs: ["allow", "block", "suggestions"],
    enforcement: ["hard-coded-color-detection", "required-variable-check", "dark-token-check", "theme-id-consistency"],
  },
  "preview-readiness": {
    id: "preview-readiness",
    title: "Preview Readiness",
    path: ".hermes/hooks/preview-readiness/HOOK.md",
    trigger: "before-completion",
    inputs: ["workspacePath", "defaultRoute", "runtimeState"],
    outputs: ["allow", "block", "previewReady"],
    enforcement: ["process-status-check", "http-reachability-check", "compile-log-inspection", "preview-ready-event-gate"],
  },
};

export const UI_BUILDER_HOOK_ORDER: HermesHookId[] = [
  "project-scope-guard",
  "generated-code-review",
  "theme-integrity",
  "preview-readiness",
];

export const UI_BUILDER_HOOKS: HermesHookDefinition[] = UI_BUILDER_HOOK_ORDER.map((hookId) => HERMES_HOOK_DEFINITIONS[hookId]);