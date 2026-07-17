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
  {
    id: "generated-nextjs-ai-engineer-cv",
    name: "AI Engineer CV",
    description: "Portfolio-style curriculum vitae for an AI engineer with experience, expertise, and proof points.",
    templatePath: "generated-nextjs-ai-engineer-cv",
    defaultThemeId: "luma-cv-indigo",
  },
  {
    id: "generated-nextjs-deep-research-paper",
    name: "Deep Research Paper",
    description: "Long-form research paper layout with abstract, findings, methods, and citation protocol.",
    templatePath: "generated-nextjs-deep-research-paper",
    defaultThemeId: "luma-amber-slate",
  },
  {
    id: "generated-nextjs-webgl-particles-home",
    name: "WebGL Particles Home",
    description: "Modern dark homepage with a native WebGL particle field and launch-style hero section.",
    templatePath: "generated-nextjs-webgl-particles-home",
    defaultThemeId: "luma-violet-cyan",
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