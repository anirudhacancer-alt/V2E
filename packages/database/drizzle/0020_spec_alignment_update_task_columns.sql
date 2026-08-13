-- Spec alignment: filters for GET /v1/updates and GET /v1/tasks (canonical reference §12.8, §12.12)
-- Adds: updates.sourceType, updates.needsReview, tasks.kind, tasks.reporterTeamMemberId

ALTER TABLE `updates` ADD COLUMN `sourceType` text DEFAULT 'voice' NOT NULL;--> statement-breakpoint
ALTER TABLE `updates` ADD COLUMN `needsReview` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `kind` text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `reporterTeamMemberId` text;
