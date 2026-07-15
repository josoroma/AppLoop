CREATE TABLE `chat_checkpoints` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `name` text NOT NULL,
  `is_session_boundary` integer DEFAULT false NOT NULL,
  `data_json` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_checkpoints_project_id_idx` ON `chat_checkpoints` (`project_id`);