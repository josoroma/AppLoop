CREATE TABLE `presentations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`workspace_path` text NOT NULL,
	`template_id` text NOT NULL,
	`source_file` text DEFAULT 'deck.md' NOT NULL,
	`hermes_session_id` text,
	`active_conversation_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presentations_slug_idx` ON `presentations` (`slug`);
--> statement-breakpoint
CREATE TABLE `presentation_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`presentation_id` text NOT NULL,
	`hermes_session_id` text,
	`title` text DEFAULT 'Presentation chat' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`presentation_id`) REFERENCES `presentations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `presentation_conversations_presentation_id_idx` ON `presentation_conversations` (`presentation_id`);
--> statement-breakpoint
CREATE TABLE `presentation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata_json` text,
	`hermes_session_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `presentation_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `presentation_messages_conversation_id_idx` ON `presentation_messages` (`conversation_id`);
