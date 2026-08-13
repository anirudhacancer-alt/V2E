-- Phase C: Improvement Actions Table
-- Structured countermeasures for repeated or systemic issues

-- Improvement actions - DMAIC loop closure
CREATE TABLE IF NOT EXISTS `improvement_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`projectId` text NOT NULL,
	`siteId` text NOT NULL,
	`title` text NOT NULL,
	`problemStatement` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`rootCause` text,
	`ownerId` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`targetDate` text,
	`linkedTaskIdsJson` text DEFAULT '[]' NOT NULL,
	`linkedBlockerIdsJson` text DEFAULT '[]' NOT NULL,
	`linkedCommitmentIdsJson` text DEFAULT '[]' NOT NULL,
	`effectivenessNote` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ownerId`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_project` ON `improvement_actions` (`projectId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_site` ON `improvement_actions` (`siteId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_owner` ON `improvement_actions` (`ownerId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_status` ON `improvement_actions` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_category` ON `improvement_actions` (`category`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_improvement_actions_target_date` ON `improvement_actions` (`targetDate`);
