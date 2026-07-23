export const DEFAULT_PROJECT_TEMPLATE_ID = "default";

export const BUILT_IN_PROJECT_TEMPLATES = [
  {
    id: DEFAULT_PROJECT_TEMPLATE_ID,
    name: "Default Next.js",
    description: "Starter app with header navigation and light/dark mode.",
    templatePath: "default",
    defaultThemeId: "luma-blue-violet",
  },
  {
    id: "admin-luma",
    name: "Luma Admin",
    description: "Dark-mode dashboard with admin navigation and reusable not-found state.",
    templatePath: "admin-luma",
    defaultThemeId: "luma-admin-amber",
  },
  {
    id: "ai-engineer-cv",
    name: "AI Engineer CV",
    description: "Portfolio-style curriculum vitae for an AI engineer with experience, expertise, and proof points.",
    templatePath: "ai-engineer-cv",
    defaultThemeId: "luma-cv-indigo",
  },
  {
    id: "deep-research-paper",
    name: "Deep Research Paper",
    description: "Long-form research paper layout with abstract, findings, methods, and citation protocol.",
    templatePath: "deep-research-paper",
    defaultThemeId: "luma-amber-slate",
  },
  {
    id: "luminous-rings",
    name: "Luminous Rings",
    description: "Dark homepage with luminous concentric WebGL laser rings and cinematic launch hero.",
    templatePath: "luminous-rings",
    defaultThemeId: "luma-violet-cyan",
  },
  {
    id: "solar-system",
    name: "Solar System Explorer",
    description: "Cinematic interactive 3D Solar System with orbiting planets, gravitational grid, and NASA integration.",
    templatePath: "solar-system",
    defaultThemeId: "luma-indigo-emerald",
  },
  {
    id: "algovivo-creature",
    name: "Algovivo Soft Creature",
    description:
      "2D neural-walker soft-body cat on algovivo (pretrained MLP gait + cat ears/tail) with neon yellow/blue/red stage and universe backdrop.",
    templatePath: "algovivo-creature",
    defaultThemeId: "luma-orange-stone",
  },
] as const;

export type ProjectTemplateId = (typeof BUILT_IN_PROJECT_TEMPLATES)[number]["id"];
export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  templatePath: string;
  defaultThemeId: string;
  source?: "built-in" | "custom";
  status?: "generating" | "ready" | "failed";
};

export type CustomProjectTemplateInput = {
  id: string;
  name: string;
  description: string;
  templatePath: string;
  defaultThemeId: string;
  source?: "custom";
  status?: "generating" | "ready" | "failed";
};

export function listProjectTemplates(customTemplates: CustomProjectTemplateInput[] = []): ProjectTemplate[] {
  return [
    ...BUILT_IN_PROJECT_TEMPLATES.map((template) => ({ ...template, source: "built-in" as const, status: "ready" as const })),
    ...customTemplates.map((template) => ({ ...template, source: "custom" as const })),
  ];
}

export function getProjectTemplate(templateId: string) {
  return listProjectTemplates().find((template) => template.id === templateId) ?? null;
}

export function assertProjectTemplate(templateId: string) {
  const template = getProjectTemplate(templateId);

  if (!template) {
    throw new Error(`Unknown project template: ${templateId}`);
  }

  return template;
}