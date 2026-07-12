CREATE INDEX IF NOT EXISTS `messages_created_at_idx` ON `messages` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `runs_status_idx` ON `runs` (`status`);