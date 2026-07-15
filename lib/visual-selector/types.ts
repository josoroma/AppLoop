import { z } from "zod";

export const SEMANTIC_BOUNDARY_CLASS_NAMES = [
  "app-shell",
  "page-shell",
  "page-header",
  "page-content",
  "page-footer",
  "dashboard-shell",
  "dashboard-header",
  "dashboard-content",
  "dashboard-footer",
  "sidebar",
  "sidebar-header",
  "sidebar-content",
  "sidebar-footer",
  "left-column",
  "center-column",
  "right-column",
  "top-section",
  "main-section",
  "bottom-section",
  "hero-section",
  "features-section",
  "pricing-section",
  "form-section",
  "table-section",
  "analytics-card",
  "summary-card",
  "primary-actions",
  "secondary-actions",
  "template-default",
  "template-admin-luma",
  // Per-instance unique classnames for repeated elements
  "metric-revenue",
  "metric-active-users",
  "metric-conversion",
  "metric-open-issues",
  "activity-panel",
  "health-panel",
  "admin-nav-link",
  "site-nav-link",
  "project-card",
  "site-theme-toggle",
  "admin-theme-toggle",
  "admin-hero-eyebrow",
  "not-found-eyebrow",
] as const;

const classNamesSchema = z.array(z.string().min(1).max(120)).max(32);

export const visualSelectionAncestrySchema = z.object({
  tagName: z.string().min(1).max(40).transform((value) => value.toLowerCase()),
  classNames: classNamesSchema,
  inspectorId: z.string().min(1).max(120).optional(),
});

export const visualSelectionSchema = z.object({
  projectId: z.string().min(1),
  previewNonce: z.string().min(8).max(120),
  route: z.string().min(1).max(2048),
  tagName: z.string().min(1).max(40).transform((value) => value.toLowerCase()),
  classNames: classNamesSchema,
  preferredSelector: z.string().min(1).max(160),
  inspectorId: z.string().min(1).max(120).optional(),
  componentName: z.string().min(1).max(120).optional(),
  sourceFile: z.string().min(1).max(512).optional(),
  sourceLine: z.number().int().positive().optional(),
  textPreview: z.string().max(240).optional(),
  ancestry: z.array(visualSelectionAncestrySchema).max(6),
  boundingRect: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative(),
  }),
});

export type VisualSelection = z.infer<typeof visualSelectionSchema>;

export type InspectorParentMessage = {
  type: "apploop:inspector:set-enabled";
  enabled: boolean;
  projectId: string;
  previewNonce: string;
};

export type InspectorChildMessage =
  | {
      type: "apploop:preview-route";
      projectId: string;
      previewNonce: string;
      route: string;
    }
  | {
      type: "apploop:inspector-hover";
      selection: VisualSelection | null;
    }
  | {
      type: "apploop:inspector-select";
      selection: VisualSelection;
      update?: boolean;
    };

export type InspectorScreenshotMessage = {
  type: "apploop:inspector-screenshot";
  projectId: string;
  previewNonce: string;
  dataUrl: string;
  selector: string;
};

export type ScreenshotAttachment = {
  id: string;
  dataUrl: string;
  serverPath: string;
  source: "inspector" | "clipboard";
  selector?: string;
  filename?: string;
};

const SENSITIVE_TEXT_PATTERNS = [/api[_-]?key/i, /bearer\s+[a-z0-9._-]+/i, /password/i, /secret/i, /token/i];

export function stripSensitiveText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 240);

  if (SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "[redacted]";
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function preferSemanticClassName(classNames: string[]) {
  return classNames.find((className) => SEMANTIC_BOUNDARY_CLASS_NAMES.includes(className as (typeof SEMANTIC_BOUNDARY_CLASS_NAMES)[number]));
}

export function getClassNameSelector(selection: Pick<VisualSelection, "classNames">) {
  const semanticClassName = preferSemanticClassName(selection.classNames);
  const className = semanticClassName ?? selection.classNames[0];

  return className ? `.${escapeClassSelector(className)}` : null;
}

export function getClassNameLabel(selection: Pick<VisualSelection, "classNames" | "tagName">) {
  if (selection.classNames.length === 0) {
    return `<${selection.tagName}>`;
  }

  return `.${selection.classNames.join(" .")}`;
}

export function getPreferredSelector(selection: Pick<VisualSelection, "classNames" | "inspectorId" | "preferredSelector">) {
  const classNameSelector = getClassNameSelector(selection);

  if (classNameSelector) {
    return classNameSelector;
  }

  if (selection.inspectorId) {
    return `[data-builder-id="${selection.inspectorId}"]`;
  }

  return selection.preferredSelector;
}

export function parseVisualSelection(input: unknown): VisualSelection | null {
  const result = visualSelectionSchema.safeParse(input);

  return result.success ? result.data : null;
}

export function createVisualSelectionPrompt(message: string, selections: VisualSelection[]) {
  if (selections.length === 0) {
    return message;
  }

  const targets = selections
    .map((selection) => {
      const classNameLabel = getClassNameLabel(selection);
      return `- ${classNameLabel} → ${selection.preferredSelector}`;
    })
    .join("\n");

  return `${message}\n\nTarget classnames (ONLY change these elements — do NOT touch other elements with the same base classname):\n${targets}\n\nApply the requested change ONLY to the elements that match these EXACT selectors. Do NOT apply the change to other elements that share the same base classnames.\n\nTarget selections JSON:\n${JSON.stringify(selections, null, 2)}`;
}

export function validateBuilderId(value: string) {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function escapeClassSelector(className: string) {
  return className.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}