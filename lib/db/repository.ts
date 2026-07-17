import type {
  Conversation,
  NewConversation,
  NewGitCommit,
  Message,
  NewMessage,
  NewProject,
  NewProjectSettings,
  NewProjectSnapshot,
  NewProjectTheme,
  NewRun,
  NewRuntime,
  NewScreenshot,
  Project,
  ProjectSettings,
  ProjectTheme,
  Runtime,
  Run,
  Screenshot,
} from "@/lib/db/schema";

export type ProjectOverview = {
  project: Project;
  conversation: Conversation | null;
  runtime: Runtime | null;
  theme: ProjectTheme | null;
  settings: ProjectSettings | null;
};

export type CreateProjectBundle = {
  project: NewProject;
  conversation: NewConversation;
  runtime: NewRuntime;
  theme: NewProjectTheme;
  settings: NewProjectSettings;
};

export type RuntimePatch = Partial<Omit<NewRuntime, "projectId">>;

export type MessagePageOptions = {
  limit?: number;
  before?: Date;
};

export interface ProjectRepository {
  createProject(project: NewProject): Promise<Project>;
  createProjectBundle(bundle: CreateProjectBundle): Promise<ProjectOverview>;
  deleteProject(projectId: string): Promise<void>;
  findProjectById(projectId: string): Promise<Project | null>;
  findProjectOverviewById(projectId: string): Promise<ProjectOverview | null>;
  listProjects(): Promise<Project[]>;
  listProjectOverviews(status?: Project["status"]): Promise<ProjectOverview[]>;
  listAllocatedPreviewPorts(): Promise<number[]>;
  createMessage(message: NewMessage): Promise<void>;
  createMessageOnce(message: NewMessage): Promise<void>;
  listConversationMessages(conversationId: string, options?: MessagePageOptions): Promise<Message[]>;
  deleteConversationMessages(conversationId: string, messageIds: string[]): Promise<void>;
  deleteConversationMessagesFrom(conversationId: string, messageId: string): Promise<void>;
  createRun(run: NewRun): Promise<Run>;
  listActiveRuns(): Promise<Run[]>;
  createProjectSnapshot(snapshot: NewProjectSnapshot): Promise<void>;
  markProjectSnapshotRestored(snapshotId: string, restoredAt: Date): Promise<void>;
  createGitCommit(commit: NewGitCommit): Promise<void>;
  rememberLastOpenedProject(projectId: string): Promise<void>;
  updateConversationHermesSession(conversationId: string, hermesSessionId: string): Promise<void>;
  updateProjectHermesSession(projectId: string, hermesSessionId: string): Promise<Project>;
  updateProjectName(projectId: string, name: string, slug: string): Promise<Project>;
  updateProjectPreviewPort(projectId: string, previewPort: number): Promise<Project>;
  updateRun(runId: string, run: Partial<Omit<NewRun, "id">>): Promise<Run>;
  updateProjectStatus(projectId: string, status: Project["status"]): Promise<Project>;
  updateRuntime(projectId: string, runtime: RuntimePatch): Promise<Runtime>;
  updateProjectSettings(projectId: string, settings: Partial<NewProjectSettings>): Promise<ProjectSettings>;
  updateProjectTheme(projectId: string, theme: Partial<Omit<NewProjectTheme, "projectId">>): Promise<ProjectTheme>;
  createScreenshot(screenshot: NewScreenshot): Promise<Screenshot>;
  findScreenshotById(screenshotId: string): Promise<Screenshot | null>;
  listProjectScreenshots(projectId: string, limit?: number): Promise<Screenshot[]>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  deleteProjectScreenshots(projectId: string): Promise<void>;
}