CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`standupId` text NOT NULL,
	`teamMemberId` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`recordedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`isActive` text NOT NULL,
	`metadata` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text NOT NULL,
	`locationLatitude` text,
	`locationLongitude` text,
	`projectManagerId` text NOT NULL,
	`isActive` text NOT NULL,
	`metadata` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `standup_attendance_records` (
	`standupId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`teamMemberId` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `standup_blocked_items` (
	`standupId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`relatedTaskId` text,
	`blockerReason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `standup_completed_items` (
	`standupId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`completionPercentage` real NOT NULL,
	`location` text
);
--> statement-breakpoint
CREATE TABLE `standup_planned_items` (
	`standupId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`location` text,
	`trade` text
);
--> statement-breakpoint
CREATE TABLE `standups` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`projectId` text NOT NULL,
	`date` text NOT NULL,
	`conductedBy` text NOT NULL,
	`attendanceTotal` integer NOT NULL,
	`attendancePresent` integer NOT NULL,
	`attendanceAbsent` integer NOT NULL,
	`attendanceRate` real NOT NULL,
	`tasksPlanned` integer NOT NULL,
	`completed` integer NOT NULL,
	`atRisk` integer NOT NULL,
	`completionRate` real NOT NULL,
	`summaryText` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`uploadedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`projectId` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`ownerId` text NOT NULL,
	`assigneeRole` text NOT NULL,
	`severity` text NOT NULL,
	`trade` text,
	`location` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`sourceUpdateId` text,
	`startDate` text NOT NULL,
	`dueDate` text NOT NULL,
	`completedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`email` text,
	`phone` text,
	`isActive` text NOT NULL,
	`joinedAt` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `update_ai_outputs` (
	`updateId` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`trade` text,
	`location` text,
	`vendor` text,
	`severity` text NOT NULL,
	`ownerRole` text NOT NULL,
	`ownerId` text,
	`dueDate` text NOT NULL,
	`generatedTaskDescription` text NOT NULL,
	`riskImpact` text NOT NULL,
	`scheduleRisk` text NOT NULL,
	`confidence` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `update_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`updateId` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`uploadedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `update_risk_downstream_effects` (
	`updateId` text NOT NULL,
	`order` integer NOT NULL,
	`effect` text NOT NULL,
	PRIMARY KEY(`updateId`, `order`)
);
--> statement-breakpoint
CREATE TABLE `update_risk_recommended_actions` (
	`updateId` text NOT NULL,
	`order` integer NOT NULL,
	`action` text NOT NULL,
	PRIMARY KEY(`updateId`, `order`)
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`siteId` text NOT NULL,
	`projectId` text NOT NULL,
	`recordedBy` text NOT NULL,
	`transcript` text NOT NULL,
	`audioUrl` text,
	`audioDuration` text,
	`status` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text NOT NULL,
	`employeeId` text NOT NULL,
	`avatarUrl` text,
	`preferences_pushNotificationsEnabled` text NOT NULL,
	`preferences_darkModeEnabled` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
