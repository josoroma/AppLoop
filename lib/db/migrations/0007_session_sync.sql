ALTER TABLE `projects` ADD `active_conversation_id` text;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `kind` text DEFAULT 'main' NOT NULL;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `parent_conversation_id` text;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `branched_from_message_id` text;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `branched_from_checkpoint_id` text;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `file_snapshot_commit` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `raw_user_prompt` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `composed_prompt` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `visual_selection_json` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `screenshot_ids_json` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `checkpoint_before_id` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `checkpoint_after_id` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `hermes_session_id` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `active` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `runs` ADD `hermes_session_id_at_start` text;
--> statement-breakpoint
ALTER TABLE `runs` ADD `hermes_session_id_at_end` text;
--> statement-breakpoint
ALTER TABLE `runs` ADD `checkpoint_before_id` text;
--> statement-breakpoint
ALTER TABLE `runs` ADD `checkpoint_after_id` text;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `conversation_id` text REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `run_id` text REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `parent_checkpoint_id` text;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `kind` text;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `hermes_session_id` text;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `hermes_message_cursor` integer;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `commit_hash` text;
--> statement-breakpoint
ALTER TABLE `chat_checkpoints` ADD `created_by_event_id` text;
--> statement-breakpoint
CREATE TABLE `session_events` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `conversation_id` text,
  `hermes_session_id` text,
  `type` text NOT NULL,
  `previous_conversation_id` text,
  `previous_hermes_session_id` text,
  `checkpoint_id` text,
  `run_id` text,
  `metadata_json` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `session_events_project_id_idx` ON `session_events` (`project_id`);
--> statement-breakpoint
CREATE INDEX `session_events_conversation_id_idx` ON `session_events` (`conversation_id`);
--> statement-breakpoint
CREATE TABLE `hermes_session_links` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `hermes_session_id` text NOT NULL,
  `source` text DEFAULT 'reserved' NOT NULL,
  `parent_hermes_session_id` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hermes_session_links_project_id_idx` ON `hermes_session_links` (`project_id`);
--> statement-breakpoint
CREATE INDEX `hermes_session_links_conversation_id_idx` ON `hermes_session_links` (`conversation_id`);
--> statement-breakpoint
UPDATE `projects`
SET `active_conversation_id` = (
  SELECT `id` FROM `conversations` WHERE `conversations`.`project_id` = `projects`.`id` ORDER BY `created_at` LIMIT 1
)
WHERE `active_conversation_id` IS NULL;
