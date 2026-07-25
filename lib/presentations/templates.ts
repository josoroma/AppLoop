export const DEFAULT_PRESENTATION_TEMPLATE_ID = "simple-3-slides";

export const BUILT_IN_PRESENTATION_TEMPLATES = [
  {
    id: DEFAULT_PRESENTATION_TEMPLATE_ID,
    name: "Simple 3 Slides",
    description: "Minimal 16:9 Marp starter — title, body, next steps (max 3 slides).",
    templatePath: "simple-3-slides",
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
