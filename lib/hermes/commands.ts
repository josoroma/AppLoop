export type HermesCommandId =
  | "project-build"
  | "project-fix"
  | "project-preview"
  | "project-theme"
  | "project-element-edit"
  | "project-validate"
  | "project-snapshot";

export type HermesCommandDefinition = {
  id: HermesCommandId;
  command: `/${HermesCommandId}`;
  title: string;
  path: string;
  inputs: string[];
  outputs: string[];
  loads: string[];
};

export const HERMES_COMMAND_DEFINITIONS: Record<HermesCommandId, HermesCommandDefinition> = {
  "project-build": {
    id: "project-build",
    command: "/project-build",
    title: "Project Build",
    path: ".hermes/commands/project-build.md",
    inputs: ["projectId", "message", "projectContext"],
    outputs: ["generatedProjectChange", "validationSummary", "previewReadiness"],
    loads: ["ui-builder", "project-scope-guard", "preview-readiness"],
  },
  "project-fix": {
    id: "project-fix",
    command: "/project-fix",
    title: "Project Fix",
    path: ".hermes/commands/project-fix.md",
    inputs: ["projectId", "failureSummary", "workspacePath"],
    outputs: ["repairSummary", "validationResult"],
    loads: ["validation-repair", "generated-code-review"],
  },
  "project-preview": {
    id: "project-preview",
    command: "/project-preview",
    title: "Project Preview",
    path: ".hermes/commands/project-preview.md",
    inputs: ["projectId", "defaultRoute", "runtimeIntent"],
    outputs: ["runtimeState", "previewUrl", "readinessFailure"],
    loads: ["project-runtime", "preview-readiness"],
  },
  "project-theme": {
    id: "project-theme",
    command: "/project-theme",
    title: "Project Theme",
    path: ".hermes/commands/project-theme.md",
    inputs: ["projectId", "selectedThemeId", "themeOperation"],
    outputs: ["themeChange", "themeValidationSummary"],
    loads: ["theme-system", "theme-integrity"],
  },
  "project-element-edit": {
    id: "project-element-edit",
    command: "/project-element-edit",
    title: "Project Element Edit",
    path: ".hermes/commands/project-element-edit.md",
    inputs: ["projectId", "selectorPayload", "message"],
    outputs: ["boundaryLimitedChange", "affectedFiles"],
    loads: ["visual-selector", "frontend-design", "generated-app-standards"],
  },
  "project-validate": {
    id: "project-validate",
    command: "/project-validate",
    title: "Project Validate",
    path: ".hermes/commands/project-validate.md",
    inputs: ["projectId", "validationDepth", "requestedCheck"],
    outputs: ["validationResult", "repairRecommendation"],
    loads: ["validation-repair", "generated-code-review", "theme-integrity", "preview-readiness"],
  },
  "project-snapshot": {
    id: "project-snapshot",
    command: "/project-snapshot",
    title: "Project Snapshot",
    path: ".hermes/commands/project-snapshot.md",
    inputs: ["projectId", "snapshotLabel", "projectContext"],
    outputs: ["snapshotSummary", "changedFiles", "validationState", "runtimeState"],
    loads: ["ui-builder"],
  },
};

export const UI_BUILDER_COMMAND_ORDER: HermesCommandId[] = [
  "project-build",
  "project-fix",
  "project-preview",
  "project-theme",
  "project-element-edit",
  "project-validate",
  "project-snapshot",
];

export const UI_BUILDER_COMMANDS: HermesCommandDefinition[] = UI_BUILDER_COMMAND_ORDER.map(
  (commandId) => HERMES_COMMAND_DEFINITIONS[commandId],
);