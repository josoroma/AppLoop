CREATE TABLE IF NOT EXISTS `project_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text,
	`label` text,
	`snapshot_path` text NOT NULL,
	`manifest_json` text NOT NULL,
	`restored_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `project_snapshots_project_id_idx` ON `project_snapshots` (`project_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `project_snapshots_run_id_idx` ON `project_snapshots` (`run_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `git_commits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text,
	`commit_sha` text NOT NULL,
	`message` text NOT NULL,
	`changed_files_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `git_commits_project_id_idx` ON `git_commits` (`project_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `git_commits_run_id_idx` ON `git_commits` (`run_id`);