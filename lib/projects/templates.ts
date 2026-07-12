export const DEFAULT_PROJECT_TEMPLATE_ID = "generated-nextjs-default";

export const BUILT_IN_PROJECT_TEMPLATES = [
  {
    id: DEFAULT_PROJECT_TEMPLATE_ID,
    name: "Default Next.js",
    description: "Starter app with header navigation and light/dark mode.",
    templatePath: "generated-nextjs-default",
    defaultThemeId: "luma-blue-violet",
  },
  {
    id: "generated-nextjs-admin-luma",
    name: "Luma Admin",
    description: "Dark-mode dashboard with admin navigation and reusable not-found state.",
    templatePath: "generated-nextjs-admin-luma",
    defaultThemeId: "luma-admin-amber",
  },
] as const;

export type ProjectTemplateId = (typeof BUILT_IN_PROJECT_TEMPLATES)[number]["id"];
export type ProjectTemplate = (typeof BUILT_IN_PROJECT_TEMPLATES)[number];

export function getProjectTemplate(templateId: string) {
  return BUILT_IN_PROJECT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function assertProjectTemplate(templateId: string) {
  const template = getProjectTemplate(templateId);

  if (!template) {
    throw new Error(`Unknown project template: ${templateId}`);
  }

  return template;
}