import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { DEFAULT_THEME_ID } from "@/lib/themes/catalog";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    workspacePath: text("workspace_path").notNull(),
    hermesSessionId: text("hermes_session_id"),
    activeConversationId: text("active_conversation_id"),
    themeId: text("theme_id").notNull().default(DEFAULT_THEME_ID),
    previewPort: integer("preview_port").notNull(),
    status: text("status", { enum: ["active", "archived", "deleted"] }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("projects_slug_idx").on(table.slug), uniqueIndex("projects_preview_port_idx").on(table.previewPort)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hermesSessionId: text("hermes_session_id"),
    title: text("title").notNull().default("Builder chat"),
    status: text("status", { enum: ["active", "archived", "deleted"] }).notNull().default("active"),
    kind: text("kind", { enum: ["main", "session", "branch"] }).notNull().default("main"),
    parentConversationId: text("parent_conversation_id"),
    branchedFromMessageId: text("branched_from_message_id"),
    branchedFromCheckpointId: text("branched_from_checkpoint_id"),
    fileSnapshotCommit: text("file_snapshot_commit"),
    ...timestamps,
  },
  (table) => [index("conversations_project_id_idx").on(table.projectId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    metadataJson: text("metadata_json"),
    rawUserPrompt: text("raw_user_prompt"),
    composedPrompt: text("composed_prompt"),
    visualSelectionJson: text("visual_selection_json"),
    screenshotIdsJson: text("screenshot_ids_json"),
    checkpointBeforeId: text("checkpoint_before_id"),
    checkpointAfterId: text("checkpoint_after_id"),
    hermesSessionId: text("hermes_session_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    hermesRunId: text("hermes_run_id"),
    hermesSessionIdAtStart: text("hermes_session_id_at_start"),
    hermesSessionIdAtEnd: text("hermes_session_id_at_end"),
    checkpointBeforeId: text("checkpoint_before_id"),
    checkpointAfterId: text("checkpoint_after_id"),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed", "cancelled", "interrupted"] })
      .notNull()
      .default("queued"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("runs_project_id_idx").on(table.projectId)],
);

export const projectSnapshots = sqliteTable(
  "project_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    label: text("label"),
    snapshotPath: text("snapshot_path").notNull(),
    manifestJson: text("manifest_json").notNull(),
    restoredAt: integer("restored_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("project_snapshots_project_id_idx").on(table.projectId), index("project_snapshots_run_id_idx").on(table.runId)],
);

export const gitCommits = sqliteTable(
  "git_commits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    commitSha: text("commit_sha").notNull(),
    message: text("message").notNull(),
    changedFilesJson: text("changed_files_json").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("git_commits_project_id_idx").on(table.projectId), index("git_commits_run_id_idx").on(table.runId)],
);

export const runtimes = sqliteTable(
  "runtimes",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    port: integer("port").notNull(),
    pid: integer("pid"),
    status: text("status", { enum: ["stopped", "starting", "running", "failed"] }).notNull().default("stopped"),
    previewUrl: text("preview_url"),
    logPath: text("log_path"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    exitCode: integer("exit_code"),
    exitSignal: text("exit_signal"),
    ...timestamps,
  },
  (table) => [uniqueIndex("runtimes_port_idx").on(table.port)],
);

export const projectThemes = sqliteTable("project_themes", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  themeId: text("theme_id").notNull().default(DEFAULT_THEME_ID),
  tokenJson: text("token_json"),
  ...timestamps,
});

export const projectSettings = sqliteTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  packageInstallPolicy: text("package_install_policy", { enum: ["auto", "ask", "never"] }).notNull().default("ask"),
  validationDepth: text("validation_depth", { enum: ["quick", "standard", "deep"] }).notNull().default("standard"),
  autoStartPreview: integer("auto_start_preview", { mode: "boolean" }).notNull().default(true),
  defaultRoute: text("default_route").notNull().default("/"),
  ...timestamps,
});

export const projectTemplates = sqliteTable(
  "project_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    templatePath: text("template_path").notNull(),
    defaultThemeId: text("default_theme_id").notNull().default(DEFAULT_THEME_ID),
    source: text("source", { enum: ["custom"] }).notNull().default("custom"),
    status: text("status", { enum: ["generating", "ready", "failed"] }).notNull().default("generating"),
    baseTemplateId: text("base_template_id").notNull(),
    sourcePrompt: text("source_prompt").notNull(),
    hermesSessionId: text("hermes_session_id"),
    hermesRunId: text("hermes_run_id"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [index("project_templates_status_idx").on(table.status)],
);

export const builderPreferences = sqliteTable("builder_preferences", {
  id: text("id").primaryKey().default("local"),
  lastOpenedProjectId: text("last_opened_project_id").references(() => projects.id, { onDelete: "set null" }),
  selectedElementJson: text("selected_element_json"),
  ...timestamps,
});

export const screenshots = sqliteTable(
  "screenshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mediaType: text("media_type").notNull().default("image/png"),
    sizeBytes: integer("size_bytes").notNull(),
    selector: text("selector"),
    source: text("source", { enum: ["inspector", "clipboard"] }).notNull().default("inspector"),
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (table) => [index("screenshots_project_id_idx").on(table.projectId)],
);

export const chatCheckpoints = sqliteTable(
  "chat_checkpoints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isSessionBoundary: integer("is_session_boundary", { mode: "boolean" }).notNull().default(false),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    parentCheckpointId: text("parent_checkpoint_id"),
    kind: text("kind", { enum: ["prompt-before", "prompt-after", "session-boundary", "restore-point", "branch-point"] }),
    hermesSessionId: text("hermes_session_id"),
    hermesMessageCursor: integer("hermes_message_cursor"),
    commitHash: text("commit_hash"),
    createdByEventId: text("created_by_event_id"),
    dataJson: text("data_json").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("chat_checkpoints_project_id_idx").on(table.projectId)],
);

export const sessionEvents = sqliteTable(
  "session_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    hermesSessionId: text("hermes_session_id"),
    type: text("type", {
      enum: ["project-created", "session-created", "prompt-submitted", "run-started", "run-completed", "checkpoint-saved", "restored", "branched", "resumed", "cancelled", "synced"],
    }).notNull(),
    previousConversationId: text("previous_conversation_id"),
    previousHermesSessionId: text("previous_hermes_session_id"),
    checkpointId: text("checkpoint_id"),
    runId: text("run_id"),
    metadataJson: text("metadata_json"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("session_events_project_id_idx").on(table.projectId), index("session_events_conversation_id_idx").on(table.conversationId)],
);

export const hermesSessionLinks = sqliteTable(
  "hermes_session_links",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    hermesSessionId: text("hermes_session_id").notNull(),
    source: text("source", { enum: ["created", "resumed", "forked", "imported", "reserved"] }).notNull().default("reserved"),
    parentHermesSessionId: text("parent_hermes_session_id"),
    status: text("status", { enum: ["active", "superseded", "archived", "invalid"] }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [index("hermes_session_links_project_id_idx").on(table.projectId), index("hermes_session_links_conversation_id_idx").on(table.conversationId)],
);

export const projectRelations = relations(projects, ({ one, many }) => ({
  runtime: one(runtimes),
  theme: one(projectThemes),
  settings: one(projectSettings),
  conversations: many(conversations),
  runs: many(runs),
  checkpoints: many(chatCheckpoints),
}));

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

export const builderTables = {
  projects,
  conversations,
  messages,
  runs,
  runtimes,
  projectSnapshots,
  gitCommits,
  projectThemes,
  projectSettings,
  projectTemplates,
  builderPreferences,
  screenshots,
  chatCheckpoints,
  sessionEvents,
  hermesSessionLinks,
};

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Runtime = typeof runtimes.$inferSelect;
export type NewRuntime = typeof runtimes.$inferInsert;
export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type NewProjectSnapshot = typeof projectSnapshots.$inferInsert;
export type GitCommit = typeof gitCommits.$inferSelect;
export type NewGitCommit = typeof gitCommits.$inferInsert;
export type ProjectTheme = typeof projectThemes.$inferSelect;
export type NewProjectTheme = typeof projectThemes.$inferInsert;
export type ProjectSettings = typeof projectSettings.$inferSelect;
export type NewProjectSettings = typeof projectSettings.$inferInsert;
export type ProjectTemplateRow = typeof projectTemplates.$inferSelect;
export type NewProjectTemplateRow = typeof projectTemplates.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Screenshot = typeof screenshots.$inferSelect;
export type NewScreenshot = typeof screenshots.$inferInsert;
export type ChatCheckpointRow = typeof chatCheckpoints.$inferSelect;
export type NewChatCheckpointRow = typeof chatCheckpoints.$inferInsert;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
export type HermesSessionLink = typeof hermesSessionLinks.$inferSelect;
export type NewHermesSessionLink = typeof hermesSessionLinks.$inferInsert;