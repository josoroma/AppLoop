import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createProjectAgentBundle } from "@/lib/hermes/agents";
import { getHermesClient } from "@/lib/hermes/store";
import type { ProjectRepository } from "@/lib/db/repository";
import { duplicateProjectWorkspace } from "@/lib/projects/files";
import { allocatePreviewPort, createUniqueSlug, projectDefaults, reserveHermesSessionId } from "@/lib/projects/service";
import { assertProjectTemplate, DEFAULT_PROJECT_TEMPLATE_ID, listProjectTemplates, type ProjectTemplate } from "@/lib/projects/templates";
import { toSafePathSegment, assertInsideRoot } from "@/lib/security/paths";
import { applyThemeToWorkspace } from "@/lib/themes/apply";
import { DEFAULT_THEME_ID } from "@/lib/themes/catalog";
import { createCustomTheme } from "@/lib/themes/registry";

const PROJECT_TEMPLATES_ROOT = path.join(process.cwd(), "templates");
const TRANSIENT_TEMPLATE_PATHS = new Set([".next", ".turbo", "node_modules", "out", "dist", "logs"]);

export type CreateCustomTemplateInput = {
  name: string;
  description?: string;
  prompt: string;
  baseTemplateId?: string;
  defaultThemeId?: string;
  themeCss: string;
};

export async function listSelectableProjectTemplates(repository: ProjectRepository): Promise<ProjectTemplate[]> {
  const customTemplates = await repository.listProjectTemplates("ready");

  return [...listProjectTemplates(), ...customTemplates.map(templateRowToProjectTemplate)];
}

export async function listManagedProjectTemplates(repository: ProjectRepository): Promise<ProjectTemplate[]> {
  const customTemplates = await repository.listProjectTemplates();

  return [...listProjectTemplates(), ...customTemplates.map(templateRowToProjectTemplate)];
}

export async function createCustomTemplate(repository: ProjectRepository, input: CreateCustomTemplateInput) {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  const baseTemplateId = input.baseTemplateId?.trim() || DEFAULT_PROJECT_TEMPLATE_ID;
  const baseTemplate = await resolveBaseTemplate(repository, baseTemplateId);
  const defaultThemeId = input.defaultThemeId?.trim() || DEFAULT_THEME_ID;
  const theme = createCustomTheme(input.themeCss.trim());

  if (!name) {
    throw new Error("Template name is required.");
  }

  if (!prompt) {
    throw new Error("Template prompt is required.");
  }

  const existingTemplateIds = new Set([
    ...listProjectTemplates().map((template) => template.id),
    ...(await repository.listProjectTemplates()).map((template) => template.id),
  ]);
  const templateId = createUniqueTemplateId(name, existingTemplateIds);
  const templatePath = templateId;
  const templateRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, templatePath));
  const baseTemplateRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, baseTemplate.templatePath));
  const description = input.description?.trim() || `Custom template generated from prompt: ${prompt.slice(0, 120)}`;

  await fs.cp(baseTemplateRoot, templateRoot, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (source) => !isTransientTemplatePath(baseTemplateRoot, source),
  });
  await stampTemplateClassname(templateRoot, baseTemplate.id, templateId);
  await applyThemeToWorkspace(templateRoot, theme);

  const createdTemplate = await repository.createProjectTemplate({
    id: templateId,
    name,
    description,
    templatePath,
    defaultThemeId,
    source: "custom",
    status: "generating",
    baseTemplateId,
    sourcePrompt: prompt,
  });

  try {
    const conversationId = randomUUID();
    const hermesClient = await getHermesClient();
    const result = await hermesClient.runProjectOnce({
      projectId: `template:${templateId}`,
      conversationId,
      message: createTemplateAuthoringPrompt({ templateId, name, description, prompt, baseTemplateId, themeCss: theme.css }),
      workspacePath: templateRoot,
      sessionId: null,
      agentBundle: createProjectAgentBundle({
        projectId: `template:${templateId}`,
        workspacePath: templateRoot,
        selectedThemeId: defaultThemeId,
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        defaultRoute: "/",
        mode: "template-authoring",
        templateId,
        templateName: name,
        templatePath,
        baseTemplateId,
      }),
    });

    await assertTemplateReady(templateRoot, templateId);

    return repository.updateProjectTemplate(createdTemplate.id, {
      status: "ready",
      hermesRunId: result.hermesRunId,
      hermesSessionId: result.sessionId,
      lastError: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template generation failed.";
    await repository.updateProjectTemplate(createdTemplate.id, { status: "failed", lastError: message });
    throw error;
  }
}

export async function cloneTemplate(repository: ProjectRepository, templateId: string) {
  const sourceTemplate = await resolveBaseTemplate(repository, templateId);
  const existingTemplateIds = new Set([
    ...listProjectTemplates().map((template) => template.id),
    ...(await repository.listProjectTemplates()).map((template) => template.id),
  ]);
  const cloneId = createUniqueTemplateId(`${sourceTemplate.name} Clone`, existingTemplateIds);
  const cloneName = `${sourceTemplate.name} Clone`;
  const sourceRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, sourceTemplate.templatePath));
  const cloneRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, cloneId));

  await duplicateProjectWorkspace(sourceRoot, cloneRoot);
  await stampTemplateClassname(cloneRoot, sourceTemplate.id, cloneId);
  await assertTemplateReady(cloneRoot, cloneId);

  return repository.createProjectTemplate({
    id: cloneId,
    name: cloneName,
    description: `Clone of ${sourceTemplate.name}.`,
    templatePath: cloneId,
    defaultThemeId: sourceTemplate.defaultThemeId,
    source: "custom",
    status: "ready",
    baseTemplateId: sourceTemplate.id,
    sourcePrompt: `Cloned from ${sourceTemplate.id}.`,
  });
}

export async function cloneTemplateForEditing(repository: ProjectRepository, templateId: string) {
  const template = await cloneTemplate(repository, templateId);
  const sourceTemplate = await resolveBaseTemplate(repository, template.id);
  const cloneName = sourceTemplate.name;
  const cloneRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, sourceTemplate.templatePath));

  const existingProjects = await repository.listProjects();
  const existingOverviews = await repository.listProjectOverviews();
  const projectId = randomUUID();
  const conversationId = randomUUID();
  const slug = createUniqueSlug(`Template ${cloneName}`, existingProjects.map((project) => project.slug));
  const hermesSessionId = reserveHermesSessionId(conversationId);
  const allocatedPorts = existingOverviews.flatMap((overview) => [overview.project.previewPort, overview.runtime?.port]).filter((port): port is number => typeof port === "number");
  const previewPort = allocatePreviewPort(allocatedPorts);

  await repository.createProjectBundle({
    project: {
      id: projectId,
      name: `Template: ${cloneName}`,
      slug,
      workspacePath: cloneRoot,
      hermesSessionId,
      activeConversationId: conversationId,
      themeId: sourceTemplate.defaultThemeId,
      previewPort,
    },
    conversation: {
      id: conversationId,
      projectId,
      hermesSessionId,
      title: `${cloneName} template edit`,
      status: "active",
      kind: "main",
    },
    runtime: {
      projectId,
      port: previewPort,
      status: "stopped",
      previewUrl: `http://127.0.0.1:${previewPort}`,
    },
    theme: {
      projectId,
      themeId: sourceTemplate.defaultThemeId,
    },
    settings: {
      projectId,
      ...projectDefaults.settings,
    },
  });

  return { template, projectId };
}

export async function openTemplateForEditing(repository: ProjectRepository, templateId: string) {
  const sourceTemplate = await resolveBaseTemplate(repository, templateId);
  const templateRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, sourceTemplate.templatePath));
  const existingProjects = await repository.listProjects();
  const existingProject = existingProjects.find((project) => path.resolve(project.workspacePath) === templateRoot && project.status === "active");

  if (existingProject) {
    return { projectId: existingProject.id };
  }

  await assertTemplateReady(templateRoot, sourceTemplate.id);

  const existingOverviews = await repository.listProjectOverviews();
  const projectId = randomUUID();
  const conversationId = randomUUID();
  const slug = createUniqueSlug(`Template ${sourceTemplate.name}`, existingProjects.map((project) => project.slug));
  const hermesSessionId = reserveHermesSessionId(conversationId);
  const allocatedPorts = existingOverviews.flatMap((overview) => [overview.project.previewPort, overview.runtime?.port]).filter((port): port is number => typeof port === "number");
  const previewPort = allocatePreviewPort(allocatedPorts);

  await repository.createProjectBundle({
    project: {
      id: projectId,
      name: `Template: ${sourceTemplate.name}`,
      slug,
      workspacePath: templateRoot,
      hermesSessionId,
      activeConversationId: conversationId,
      themeId: sourceTemplate.defaultThemeId,
      previewPort,
    },
    conversation: {
      id: conversationId,
      projectId,
      hermesSessionId,
      title: `${sourceTemplate.name} template edit`,
      status: "active",
      kind: "main",
    },
    runtime: {
      projectId,
      port: previewPort,
      status: "stopped",
      previewUrl: `http://127.0.0.1:${previewPort}`,
    },
    theme: {
      projectId,
      themeId: sourceTemplate.defaultThemeId,
    },
    settings: {
      projectId,
      ...projectDefaults.settings,
    },
  });

  return { projectId };
}

export async function deleteCustomTemplate(repository: ProjectRepository, templateId: string) {
  const template = await repository.findProjectTemplateById(templateId);

  if (!template) {
    throw new Error("Custom template not found.");
  }

  const templateRoot = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, template.templatePath));

  await fs.rm(templateRoot, { recursive: true, force: true });
  await repository.deleteProjectTemplate(templateId);
}

export function getTemplateIdFromWorkspacePath(workspacePath: string) {
  const relativePath = path.relative(PROJECT_TEMPLATES_ROOT, path.resolve(workspacePath));

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.split(path.sep)[0] || null;
}

async function resolveBaseTemplate(repository: ProjectRepository, templateId: string): Promise<ProjectTemplate> {
  try {
    return assertProjectTemplate(templateId);
  } catch (error) {
    const customTemplate = await repository.findProjectTemplateById(templateId);

    if (!customTemplate || customTemplate.status !== "ready") {
      throw error;
    }

    return templateRowToProjectTemplate(customTemplate);
  }
}

function templateRowToProjectTemplate(template: Awaited<ReturnType<ProjectRepository["listProjectTemplates"]>>[number]): ProjectTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    templatePath: template.templatePath,
    defaultThemeId: template.defaultThemeId,
    source: "custom" as const,
    status: template.status,
  };
}

function createUniqueTemplateId(name: string, existingTemplateIds: Set<string>) {
  const baseId = toSafePathSegment(name);
  let templateId = baseId;
  let suffix = 2;

  while (existingTemplateIds.has(templateId)) {
    templateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return templateId;
}

function isTransientTemplatePath(sourceTemplatePath: string, sourcePath: string) {
  const relativePath = path.relative(sourceTemplatePath, sourcePath);
  const [topLevelPath] = relativePath.split(path.sep);

  return TRANSIENT_TEMPLATE_PATHS.has(topLevelPath);
}

async function stampTemplateClassname(templateRoot: string, baseTemplateId: string, templateId: string) {
  const layoutPath = path.join(templateRoot, "app", "layout.tsx");
  const source = await fs.readFile(layoutPath, "utf8");
  const stamped = source.replaceAll(`template-${baseTemplateId}`, `template-${templateId}`);

  await fs.writeFile(layoutPath, stamped, "utf8");
}

async function assertTemplateReady(templateRoot: string, templateId: string) {
  const requiredPaths = ["package.json", "app/layout.tsx", "app/page.tsx", "app/globals.css", "components/inspector-provider.tsx", "components/theme-provider.tsx"];

  for (const relativePath of requiredPaths) {
    await fs.access(path.join(templateRoot, relativePath));
  }

  const layoutSource = await fs.readFile(path.join(templateRoot, "app", "layout.tsx"), "utf8");

  if (!layoutSource.includes(`template-${templateId}`)) {
    throw new Error(`Generated template must keep body classname template-${templateId}.`);
  }
}

function createTemplateAuthoringPrompt(input: { templateId: string; name: string; description: string; prompt: string; baseTemplateId: string; themeCss: string }) {
  return [
    `Create a new AppLoop project template named "${input.name}".`,
    `Template ID/body classname: template-${input.templateId}`,
    `Base template: ${input.baseTemplateId}`,
    `Template description: ${input.description}`,
    "",
    "User template brief:",
    input.prompt,
    "",
    "Editable theme CSS already applied to app/globals.css before this run:",
    input.themeCss,
    "",
    "Use the repo-local AppLoop .hermes agents, /ui-builder bundle, skills, hooks, and commands included in the agentBundle.",
    "Edit only this template workspace. Keep it a standalone generated Next.js app that can be copied for future projects.",
    "Every user-visible UI element must be inspect-addressable with shared/base classnames plus a unique human-readable classname written last.",
    "Preserve components/inspector-provider.tsx and components/theme-provider.tsx compatibility unless the brief explicitly requires a safe template-local change.",
    "Run the narrowest relevant validation available inside the template, and report changed files and validation results.",
  ].join("\n");
}
