CREATE TABLE `project_settings` (
  `project_id` text PRIMARY KEY NOT NULL,
  `package_install_policy` text DEFAULT 'ask' NOT NULL,
  `validation_depth` text DEFAULT 'standard' NOT NULL,
  `auto_start_preview` integer DEFAULT true NOT NULL,
  `default_route` text DEFAULT '/' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE TABLE `builder_preferences` (
  `id` text DEFAULT 'local' PRIMARY KEY NOT NULL,
  `last_opened_project_id` text,
  `selected_element_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`last_opened_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);