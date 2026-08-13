CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`projectId` text NOT NULL,
	`sessionDate` text NOT NULL,
	`conductedBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`teamMemberId` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`recordedAt` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `update_attachments` ADD `taskId` text;