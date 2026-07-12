CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `workspace_path` text NOT NULL,
  `hermes_session_id` text,
  `theme_id` text DEFAULT 'luma-default' NOT NULL,
  `preview_port` integer NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_idx` ON `projects` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_preview_port_idx` ON `projects` (`preview_port`);

--> statement-breakpoint
CREATE TABLE `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `hermes_session_id` text,
  `title` text DEFAULT 'Builder chat' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_project_id_idx` ON `conversations` (`project_id`);

--> statement-breakpoint
CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `metadata_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_id_idx` ON `messages` (`conversation_id`);

--> statement-breakpoint
CREATE TABLE `runs` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `conversation_id` text,
  `hermes_run_id` text,
  `status` text DEFAULT 'queued' NOT NULL,
  `started_at` integer,
  `finished_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `runs_project_id_idx` ON `runs` (`project_id`);

--> statement-breakpoint
CREATE TABLE `runtimes` (
  `project_id` text PRIMARY KEY NOT NULL,
  `port` integer NOT NULL,
  `pid` integer,
  `status` text DEFAULT 'stopped' NOT NULL,
  `preview_url` text,
  `log_path` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runtimes_port_idx` ON `runtimes` (`port`);

--> statement-breakpoint
CREATE TABLE `project_themes` (
  `project_id` text PRIMARY KEY NOT NULL,
  `theme_id` text DEFAULT 'luma-default' NOT NULL,
  `token_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);