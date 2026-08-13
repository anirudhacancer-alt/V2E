-- Phase B: Agile Execution Layer Tables
-- Adds: work_cycles, commitments, task_dependencies

-- Work cycles - weekly/bi-weekly planning horizons
CREATE TABLE IF NOT EXISTS `work_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`goal` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Commitments - what teams commit to deliver in standup/planning cycles
CREATE TABLE IF NOT EXISTS `commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`projectId` text NOT NULL,
	`siteId` text NOT NULL,
	`workCycleId` text,
	`standupSessionId` text,
	`sourceTaskId` text,
	`title` text NOT NULL,
	`description` text,
	`ownerId` text NOT NULL,
	`assigneeRoleCode` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`commitDate` text NOT NULL,
	`targetDate` text NOT NULL,
	`completedAt` text,
	`carriedOverFromCommitmentId` text,
	`riskReason` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workCycleId`) REFERENCES `work_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sourceTaskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ownerId`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigneeRoleCode`) REFERENCES `role_types`(`code`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Task dependencies - explicit sequencing and constraint management
CREATE TABLE IF NOT EXISTS `task_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`projectId` text NOT NULL,
	`predecessorTaskId` text NOT NULL,
	`successorTaskId` text NOT NULL,
	`dependencyType` text DEFAULT 'finish_to_start' NOT NULL,
	`lagDays` integer DEFAULT 0 NOT NULL,
	`isHardConstraint` integer DEFAULT 1 NOT NULL,
	`reason` text,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`predecessorTaskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`successorTaskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS `idx_work_cycles_project` ON `work_cycles` (`projectId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_work_cycles_status` ON `work_cycles` (`status`);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_commitments_project` ON `commitments` (`projectId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_commitments_owner` ON `commitments` (`ownerId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_commitments_status` ON `commitments` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_commitments_target_date` ON `commitments` (`targetDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_commitments_work_cycle` ON `commitments` (`workCycleId`);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_task_dependencies_project` ON `task_dependencies` (`projectId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_task_dependencies_predecessor` ON `task_dependencies` (`predecessorTaskId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_task_dependencies_successor` ON `task_dependencies` (`successorTaskId`);
