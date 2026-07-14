CREATE TABLE IF NOT EXISTS `screenshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`filename` text NOT NULL,
	`media_type` text DEFAULT 'image/png' NOT NULL,
	`size_bytes` integer NOT NULL,
	`selector` text,
	`source` text DEFAULT 'inspector' NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `screenshots_project_id_idx` ON `screenshots` (`project_id`);