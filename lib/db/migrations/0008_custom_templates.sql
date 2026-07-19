CREATE TABLE `project_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `template_path` text NOT NULL,
  `default_theme_id` text DEFAULT 'luma-indigo-emerald' NOT NULL,
  `source` text DEFAULT 'custom' NOT NULL,
  `status` text DEFAULT 'generating' NOT NULL,
  `base_template_id` text NOT NULL,
  `source_prompt` text NOT NULL,
  `hermes_session_id` text,
  `hermes_run_id` text,
  `last_error` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_templates_status_idx` ON `project_templates` (`status`);
