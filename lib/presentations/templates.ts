export const DEFAULT_PRESENTATION_TEMPLATE_ID = "simple-3-slides";

export const BUILT_IN_PRESENTATION_TEMPLATES = [
  {
    id: DEFAULT_PRESENTATION_TEMPLATE_ID,
    name: "Simple 3 Slides",
    description: "Minimal 16:9 Marp starter — title, body, next steps (max 3 slides).",
    templatePath: "simple-3-slides",
    sourceFile: "deck.md",
  },
  {
    id: "claude-code-harness",
    name: "Claude Code Harness",
    description: "Spec-driven agent harness deck for Claude Code workflows, rules, skills, agents, hooks, and delivery gates.",
    templatePath: "claude-code-harness",
    sourceFile: "deck.md",
  },
  {
    id: "hermes-agent-harness",
    name: "Hermes Agent Harness",
    description: "Hermes Agent inspired cobalt deck explaining Hermes, AppLoop's custom local harness, bundles, isolation, and edit flow.",
    templatePath: "hermes-agent-harness",
    sourceFile: "deck.md",
  },
] as const;

export type PresentationTemplateId = (typeof BUILT_IN_PRESENTATION_TEMPLATES)[number]["id"];

export type PresentationTemplate = {
  id: string;
  name: string;
  description: string;
  templatePath: string;
  sourceFile: string;
  source?: "built-in";
};

export function listPresentationTemplates(): PresentationTemplate[] {
  return BUILT_IN_PRESENTATION_TEMPLATES.map((template) => ({
    ...template,
    source: "built-in" as const,
  }));
}

export function getPresentationTemplate(templateId: string) {
  return listPresentationTemplates().find((template) => template.id === templateId) ?? null;
}

export function assertPresentationTemplate(templateId: string) {
  const template = getPresentationTemplate(templateId);

  if (!template) {
    throw new Error(`Unknown presentation template: ${templateId}`);
  }

  return template;
}
