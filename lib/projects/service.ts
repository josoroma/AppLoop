import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ProjectRepository } from "@/lib/db/repository";
import type { NewProjectSettings } from "@/lib/db/schema";
import { DEFAULT_PREVIEW_PORT_RANGE, assertPreviewPort, type PreviewPortRange } from "@/lib/runtime/ports";
import { assertInsideRoot, toSafePathSegment } from "@/lib/security/paths";
import { createCustomTheme, DEFAULT_THEME_ID, getProjectTheme, serializeThemeForStorage } from "@/lib/themes/registry";

const projectNameInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const createProjectInputSchema = projectNameInputSchema.extend({
  themeId: z.string().trim().min(1).default(DEFAULT_THEME_ID).refine((themeId) => Boolean(getProjectTheme(themeId)), "Unknown project theme."),
});

export const renameProjectInputSchema = projectNameInputSchema.extend({
  projectId: z.string().min(1),
});

export const projectSettingsInputSchema = z.object({
  projectId: z.string().min(1),
  packageInstallPolicy: z.enum(["auto", "ask", "never"]),
  validationDepth: z.enum(["quick", "standard", "deep"]),
  autoStartPreview: z.boolean(),
  defaultRoute: z.string().trim().min(1).startsWith("/"),
  themeId: z.string().trim().min(1).default(DEFAULT_THEME_ID),
  customThemeCss: z.string().optional(),
}).superRefine((input, context) => {
  if (!input.customThemeCss?.trim() && !getProjectTheme(input.themeId)) {
    context.addIssue({
      code: "custom",
      message: "Unknown project theme.",
      path: ["themeId"],
    });
  }
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type RenameProjectInput = z.infer<typeof renameProjectInputSchema>;
export type ProjectSettingsInput = z.infer<typeof projectSettingsInputSchema>;

export function createProjectSlug(name: string) {
  return toSafePathSegment(name);
}

export function resolveProjectWorkspacePath(projectsRoot: string, slug: string) {
  return assertInsideRoot(projectsRoot, path.join(projectsRoot, toSafePathSegment(slug)));
}

export function formatProjectWorkspacePath(workspacePath: string, basePath = process.cwd()) {
  const relativePath = path.isAbsolute(workspacePath) ? path.relative(basePath, workspacePath) : workspacePath;

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.basename(workspacePath);
  }

  return relativePath.split(path.sep).join("/");
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly previewPortRange: PreviewPortRange = DEFAULT_PREVIEW_PORT_RANGE,
  ) {}

  async createProject(input: CreateProjectInput, projectsRoot: string) {
    const parsedInput = createProjectInputSchema.parse(input);
    const existingProjects = await this.repository.listProjects();
    const slug = createUniqueSlug(parsedInput.name, existingProjects.map((project) => project.slug));
    const projectId = randomUUID();
    const conversationId = randomUUID();
    const previewPort = allocatePreviewPort(await this.listAllocatedProjectAndRuntimePorts(), this.previewPortRange);
    const workspacePath = resolveProjectWorkspacePath(projectsRoot, slug);
    const hermesSessionId = reserveHermesSessionId(conversationId);

    return this.repository.createProjectBundle({
      project: {
        id: projectId,
        name: parsedInput.name,
        slug,
        workspacePath,
        hermesSessionId,
        activeConversationId: conversationId,
        themeId: parsedInput.themeId,
        previewPort,
      },
      conversation: {
        id: conversationId,
        projectId,
        hermesSessionId,
        title: `${parsedInput.name} chat`,
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
        themeId: parsedInput.themeId,
      },
      settings: {
        projectId,
        ...projectDefaults.settings,
      },
    });
  }

  async duplicateProject(projectId: string, copiedName?: string) {
    const source = await this.repository.findProjectOverviewById(projectId);

    if (!source) {
      throw new Error("Project not found.");
    }

    const existingProjects = await this.repository.listProjects();
    const name = copiedName?.trim() || `${source.project.name} Copy`;
    const slug = createUniqueSlug(name, existingProjects.map((project) => project.slug));
    const newProjectId = randomUUID();
    const conversationId = randomUUID();
    const previewPort = allocatePreviewPort(await this.listAllocatedProjectAndRuntimePorts(), this.previewPortRange);
    const workspacePath = path.join(path.dirname(source.project.workspacePath), slug);
    const hermesSessionId = reserveHermesSessionId(conversationId);

    return this.repository.createProjectBundle({
      project: {
        id: newProjectId,
        name,
        slug,
        workspacePath,
        hermesSessionId,
        activeConversationId: conversationId,
        themeId: source.project.themeId,
        previewPort,
      },
      conversation: {
        id: conversationId,
        projectId: newProjectId,
        hermesSessionId,
        title: `${name} chat`,
        status: "active",
        kind: "main",
      },
      runtime: {
        projectId: newProjectId,
        port: previewPort,
        status: "stopped",
        previewUrl: `http://127.0.0.1:${previewPort}`,
      },
      theme: {
        projectId: newProjectId,
        themeId: source.theme?.themeId ?? source.project.themeId,
        tokenJson: source.theme?.tokenJson,
      },
      settings: {
        projectId: newProjectId,
        packageInstallPolicy: source.settings?.packageInstallPolicy ?? projectDefaults.settings.packageInstallPolicy,
        validationDepth: source.settings?.validationDepth ?? projectDefaults.settings.validationDepth,
        autoStartPreview: source.settings?.autoStartPreview ?? projectDefaults.settings.autoStartPreview,
        defaultRoute: source.settings?.defaultRoute ?? projectDefaults.settings.defaultRoute,
      },
    });
  }

  listProjects() {
    return this.repository.listProjects();
  }

  listActiveProjects() {
    return this.repository.listProjectOverviews("active");
  }

  listArchivedProjects() {
    return this.repository.listProjectOverviews("archived");
  }

  findProject(projectId: string) {
    return this.repository.findProjectById(projectId);
  }

  findProjectOverview(projectId: string) {
    return this.repository.findProjectOverviewById(projectId);
  }

  async startNewProjectConversation(projectId: string) {
    const overview = await this.repository.findProjectOverviewById(projectId);

    if (!overview) {
      throw new Error("Project not found.");
    }

    const conversationId = randomUUID();
    const hermesSessionId = reserveHermesSessionId(conversationId);
    const conversation = await this.repository.createConversation({
      id: conversationId,
      projectId,
      hermesSessionId,
      title: `${overview.project.name} session`,
      status: "active",
      kind: "session",
      parentConversationId: overview.conversation?.id ?? null,
    });

    await this.repository.setActiveConversation(projectId, conversation.id, conversation.hermesSessionId);

    return conversation;
  }

  rememberLastOpenedProject(projectId: string) {
    return this.repository.rememberLastOpenedProject(projectId);
  }

  async renameProject(input: RenameProjectInput) {
    const parsedInput = renameProjectInputSchema.parse(input);
    const existingProjects = (await this.repository.listProjects()).filter((project) => project.id !== parsedInput.projectId);
    const slug = createUniqueSlug(parsedInput.name, existingProjects.map((project) => project.slug));

    return this.repository.updateProjectName(parsedInput.projectId, parsedInput.name, slug);
  }

  archiveProject(projectId: string) {
    return this.repository.updateProjectStatus(projectId, "archived");
  }

  restoreProject(projectId: string) {
    return this.repository.updateProjectStatus(projectId, "active");
  }

  deleteProject(projectId: string) {
    return this.repository.deleteProject(projectId);
  }

  updateProjectSettings(input: ProjectSettingsInput) {
    const parsedInput = projectSettingsInputSchema.parse(input);
    const settings: Partial<NewProjectSettings> = {
      packageInstallPolicy: parsedInput.packageInstallPolicy,
      validationDepth: parsedInput.validationDepth,
      autoStartPreview: parsedInput.autoStartPreview,
      defaultRoute: parsedInput.defaultRoute,
    };

    return this.repository.updateProjectSettings(parsedInput.projectId, settings);
  }

  async updateProjectTheme(input: Pick<ProjectSettingsInput, "projectId" | "themeId" | "customThemeCss">) {
    const theme = input.customThemeCss?.trim() ? createCustomTheme(input.customThemeCss) : getProjectTheme(input.themeId);

    if (!theme) {
      throw new Error(`Unknown project theme: ${input.themeId}`);
    }

    return this.repository.updateProjectTheme(input.projectId, {
      themeId: theme.id,
      tokenJson: theme.source === "custom" ? serializeThemeForStorage(theme) : null,
    });
  }

  private async listAllocatedProjectAndRuntimePorts() {
    const overviews = await this.repository.listProjectOverviews();

    return overviews
      .flatMap((overview) => [overview.project.previewPort, overview.runtime?.port])
      .filter((port): port is number => typeof port === "number");
  }
}

export const projectDefaults = {
  themeId: DEFAULT_THEME_ID,
  settings: {
    packageInstallPolicy: "ask",
    validationDepth: "standard",
    autoStartPreview: true,
    defaultRoute: "/",
  } satisfies Omit<NewProjectSettings, "projectId">,
};

export function createUniqueSlug(name: string, existingSlugs: string[]) {
  const baseSlug = createProjectSlug(name);
  const reservedSlugs = new Set(existingSlugs);

  if (!reservedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;

    if (!reservedSlugs.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to create a unique project slug.");
}

export function allocatePreviewPort(usedPorts: number[], range: PreviewPortRange = DEFAULT_PREVIEW_PORT_RANGE) {
  const usedPortSet = new Set(usedPorts);

  for (let port = range.start; port <= range.end; port += 1) {
    if (!usedPortSet.has(port)) {
      return assertPreviewPort(port, range);
    }
  }

  throw new Error(`No preview ports are available in range ${range.start}-${range.end}.`);
}

export function reserveHermesSessionId(projectId: string) {
  return `reserved:${projectId}`;
}