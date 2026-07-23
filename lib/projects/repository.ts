import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { BuilderDatabase } from "@/lib/db";
import {
  builderPreferences,
  conversations,
  gitCommits,
  messages,
  projectSettings,
  projectSnapshots,
  projectTemplates,
  projectThemes,
  projects,
  runs,
  runtimes,
  screenshots,
} from "@/lib/db/schema";
import type {
  CreateProjectBundle,
  MessagePageOptions,
  ProjectOverview,
  ProjectRepository,
  RuntimePatch,
} from "@/lib/db/repository";
import type { NewConversation, NewGitCommit, NewMessage, NewProject, NewProjectSettings, NewProjectSnapshot, NewProjectTemplateRow, NewProjectTheme, NewRun, NewScreenshot, Project } from "@/lib/db/schema";

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: BuilderDatabase) {}

  async createProject(project: NewProject) {
    const [createdProject] = await this.db.insert(projects).values(project).returning();

    return createdProject;
  }

  async createProjectBundle(bundle: CreateProjectBundle) {
    try {
      await this.db.insert(projects).values(bundle.project);
      await this.db.insert(conversations).values(bundle.conversation);
      await this.db.insert(runtimes).values(bundle.runtime);
      await this.db.insert(projectThemes).values(bundle.theme);
      await this.db.insert(projectSettings).values(bundle.settings);

      const overview = await this.findProjectOverviewById(bundle.project.id);

      if (!overview) {
        throw new Error("Created project could not be loaded.");
      }

      return overview;
    } catch (error) {
      await this.db.delete(projects).where(eq(projects.id, bundle.project.id));
      throw error;
    }
  }

  async createConversation(conversation: NewConversation) {
    const [createdConversation] = await this.db.insert(conversations).values(conversation).returning();

    return createdConversation;
  }

  async deleteProject(projectId: string) {
    await this.db.delete(projects).where(eq(projects.id, projectId));
  }

  async findProjectById(projectId: string) {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    return project ?? null;
  }

  async findConversationById(conversationId: string) {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);

    return conversation ?? null;
  }

  async findProjectOverviewById(projectId: string) {
    const project = await this.findProjectById(projectId);

    if (!project) {
      return null;
    }

    return this.hydrateProjectOverview(project);
  }

  async listProjects() {
    return this.db.select().from(projects).orderBy(asc(projects.createdAt));
  }

  async listProjectOverviews(status?: Project["status"]) {
    const projectRows = status
      ? await this.db.select().from(projects).where(eq(projects.status, status)).orderBy(asc(projects.createdAt))
      : await this.listProjects();

    return Promise.all(projectRows.map((project) => this.hydrateProjectOverview(project)));
  }

  async listAllocatedPreviewPorts() {
    const rows = await this.db.select({ previewPort: projects.previewPort }).from(projects);

    return rows.map((row) => row.previewPort);
  }

  async createProjectTemplate(template: NewProjectTemplateRow) {
    const [createdTemplate] = await this.db.insert(projectTemplates).values(template).returning();

    return createdTemplate;
  }

  async listProjectTemplates(status?: "generating" | "ready" | "failed") {
    return status
      ? this.db.select().from(projectTemplates).where(eq(projectTemplates.status, status)).orderBy(asc(projectTemplates.createdAt))
      : this.db.select().from(projectTemplates).orderBy(asc(projectTemplates.createdAt));
  }

  async findProjectTemplateById(templateId: string) {
    const [template] = await this.db.select().from(projectTemplates).where(eq(projectTemplates.id, templateId)).limit(1);

    return template ?? null;
  }

  async updateProjectTemplate(templateId: string, template: Partial<Omit<NewProjectTemplateRow, "id">>) {
    const [updatedTemplate] = await this.db
      .update(projectTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(projectTemplates.id, templateId))
      .returning();

    if (!updatedTemplate) {
      throw new Error("Project template not found.");
    }

    return updatedTemplate;
  }

  async deleteProjectTemplate(templateId: string) {
    await this.db.delete(projectTemplates).where(eq(projectTemplates.id, templateId));
  }

  async createMessage(message: NewMessage) {
    await this.db.insert(messages).values(message);
  }

  async createMessageOnce(message: NewMessage) {
    await this.db.insert(messages).values(message).onConflictDoNothing({ target: messages.id });
  }

  async listConversationMessages(conversationId: string, options: MessagePageOptions = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const whereClause = options.before
      ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, options.before))
      : eq(messages.conversationId, conversationId);
    const rows = await this.db
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse();
  }

  async deleteConversationMessages(conversationId: string, messageIds: string[]) {
    if (messageIds.length === 0) return;

    await this.db.delete(messages).where(and(eq(messages.conversationId, conversationId), inArray(messages.id, messageIds)));
  }

  async deleteConversationMessagesFrom(conversationId: string, messageId: string) {
    const [message] = await this.db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.id, messageId)))
      .limit(1);

    if (!message) return;

    await this.db.delete(messages).where(and(eq(messages.conversationId, conversationId), gte(messages.createdAt, message.createdAt)));
  }

  async createRun(run: NewRun) {
    const [createdRun] = await this.db.insert(runs).values(run).returning();

    return createdRun;
  }

  async listActiveRuns() {
    return this.db.select().from(runs).where(inArray(runs.status, ["queued", "running"])).orderBy(asc(runs.createdAt));
  }

  async createProjectSnapshot(snapshot: NewProjectSnapshot) {
    await this.db.insert(projectSnapshots).values(snapshot);
  }

  async markProjectSnapshotRestored(snapshotId: string, restoredAt: Date) {
    await this.db.update(projectSnapshots).set({ restoredAt, updatedAt: restoredAt }).where(eq(projectSnapshots.id, snapshotId));
  }

  async createGitCommit(commit: NewGitCommit) {
    await this.db.insert(gitCommits).values(commit);
  }

  async rememberLastOpenedProject(projectId: string) {
    const now = new Date();

    await this.db
      .insert(builderPreferences)
      .values({ id: "local", lastOpenedProjectId: projectId, updatedAt: now })
      .onConflictDoUpdate({
        target: builderPreferences.id,
        set: { lastOpenedProjectId: projectId, selectedElementJson: null, updatedAt: now },
      });
  }

  async getBuilderPreferences() {
    const [preferences] = await this.db.select().from(builderPreferences).where(eq(builderPreferences.id, "local")).limit(1);
    return preferences ?? null;
  }

  async updateBuilderPreferences(preferences: Partial<{ lastOpenedProjectId: string | null; selectedElementJson: string | null; defaultHermesModelId: string }>) {
    const now = new Date();
    const [updated] = await this.db
      .insert(builderPreferences)
      .values({
        id: "local",
        lastOpenedProjectId: preferences.lastOpenedProjectId ?? null,
        selectedElementJson: preferences.selectedElementJson ?? null,
        defaultHermesModelId: preferences.defaultHermesModelId ?? "deepseek-v4-pro",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: builderPreferences.id,
        set: { ...preferences, updatedAt: now },
      })
      .returning();

    return updated;
  }

  async setActiveConversation(projectId: string, conversationId: string, hermesSessionId: string | null) {
    const [project] = await this.db
      .update(projects)
      .set({ activeConversationId: conversationId, hermesSessionId, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  async updateConversationHermesSession(conversationId: string, hermesSessionId: string) {
    await this.db
      .update(conversations)
      .set({ hermesSessionId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async updateProjectHermesSession(projectId: string, hermesSessionId: string) {
    const [project] = await this.db
      .update(projects)
      .set({ hermesSessionId, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  async updateProjectName(projectId: string, name: string, slug: string) {
    const [project] = await this.db
      .update(projects)
      .set({ name, slug, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  async updateProjectPreviewPort(projectId: string, previewPort: number) {
    const [project] = await this.db
      .update(projects)
      .set({ previewPort, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  async updateRun(runId: string, run: Partial<Omit<NewRun, "id">>) {
    const [updatedRun] = await this.db
      .update(runs)
      .set({ ...run, updatedAt: new Date() })
      .where(eq(runs.id, runId))
      .returning();

    if (!updatedRun) {
      throw new Error("Run not found.");
    }

    return updatedRun;
  }

  async updateProjectStatus(projectId: string, status: Project["status"]) {
    const [project] = await this.db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  async updateRuntime(projectId: string, runtime: RuntimePatch) {
    const now = new Date();
    const [updatedRuntime] = await this.db
      .insert(runtimes)
      .values({ projectId, port: runtime.port ?? 0, ...runtime, updatedAt: now })
      .onConflictDoUpdate({
        target: runtimes.projectId,
        set: { ...runtime, updatedAt: now },
      })
      .returning();

    return updatedRuntime;
  }

  async updateProjectSettings(projectId: string, settings: Partial<NewProjectSettings>) {
    const now = new Date();
    const [updatedSettings] = await this.db
      .insert(projectSettings)
      .values({ projectId, ...settings, updatedAt: now })
      .onConflictDoUpdate({
        target: projectSettings.projectId,
        set: { ...settings, updatedAt: now },
      })
      .returning();

    return updatedSettings;
  }

  async updateProjectTheme(projectId: string, theme: Partial<Omit<NewProjectTheme, "projectId">>) {
    const now = new Date();
    const [updatedTheme] = await this.db
      .insert(projectThemes)
      .values({ projectId, ...theme, updatedAt: now })
      .onConflictDoUpdate({
        target: projectThemes.projectId,
        set: { ...theme, updatedAt: now },
      })
      .returning();

    if (theme.themeId) {
      await this.db.update(projects).set({ themeId: theme.themeId, updatedAt: now }).where(eq(projects.id, projectId));
    }

    return updatedTheme;
  }

  async createScreenshot(screenshot: NewScreenshot) {
    const [created] = await this.db.insert(screenshots).values(screenshot).returning();

    return created;
  }

  async findScreenshotById(screenshotId: string) {
    const [screenshot] = await this.db.select().from(screenshots).where(eq(screenshots.id, screenshotId)).limit(1);

    return screenshot ?? null;
  }

  async listProjectScreenshots(projectId: string, limit = 50) {
    return this.db
      .select()
      .from(screenshots)
      .where(eq(screenshots.projectId, projectId))
      .orderBy(desc(screenshots.createdAt))
      .limit(limit);
  }

  async deleteScreenshot(screenshotId: string) {
    await this.db.delete(screenshots).where(eq(screenshots.id, screenshotId));
  }

  async deleteProjectScreenshots(projectId: string) {
    await this.db.delete(screenshots).where(eq(screenshots.projectId, projectId));
  }

  private async hydrateProjectOverview(project: Project): Promise<ProjectOverview> {
    const activeConversation = project.activeConversationId ? await this.findConversationById(project.activeConversationId) : null;
    const [fallbackConversation] = activeConversation
      ? [activeConversation]
      : await this.db
          .select()
          .from(conversations)
          .where(eq(conversations.projectId, project.id))
          .limit(1);
    const [runtime] = await this.db.select().from(runtimes).where(eq(runtimes.projectId, project.id)).limit(1);
    const [theme] = await this.db.select().from(projectThemes).where(eq(projectThemes.projectId, project.id)).limit(1);
    const [settings] = await this.db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, project.id))
      .limit(1);

    return {
      project,
      conversation: activeConversation ?? fallbackConversation ?? null,
      runtime: runtime ?? null,
      theme: theme ?? null,
      settings: settings ?? null,
    };
  }
}