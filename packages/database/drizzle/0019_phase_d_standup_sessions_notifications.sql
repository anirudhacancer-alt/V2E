-- Phase D: Standup Sessions and Notifications Tables
-- Adds: standup_sessions, notifications, notification_preferences, delivery_attempts

-- Standup sessions - persisted standup meeting instances
CREATE TABLE IF NOT EXISTS `standup_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`projectId` text NOT NULL,
	`scopeLevel` text NOT NULL,
	`scopeRef` text,
	`sessionDate` text NOT NULL,
	`ownerId` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`summaryText` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ownerId`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Notifications - user-facing notification instances
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entityType` text,
	`entityId` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`createdAt` text NOT NULL,
	`readAt` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Notification preferences - per-user notification settings
CREATE TABLE IF NOT EXISTS `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`channel` text NOT NULL,
	`eventType` text NOT NULL,
	`isEnabled` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Delivery attempts - notification delivery audit trail
CREATE TABLE IF NOT EXISTS `delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`notificationId` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`attemptedAt` text NOT NULL,
	`providerResponse` text,
	FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Indexes for standup_sessions
CREATE INDEX IF NOT EXISTS `idx_standup_sessions_project` ON `standup_sessions` (`projectId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_standup_sessions_owner` ON `standup_sessions` (`ownerId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_standup_sessions_status` ON `standup_sessions` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_standup_sessions_date` ON `standup_sessions` (`sessionDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_standup_sessions_scope` ON `standup_sessions` (`scopeLevel`, `scopeRef`);--> statement-breakpoint

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS `idx_notifications_user` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_status` ON `notifications` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_type` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_entity` ON `notifications` (`entityType`, `entityId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_created` ON `notifications` (`createdAt`);--> statement-breakpoint

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS `idx_notification_preferences_user` ON `notification_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notification_preferences_channel` ON `notification_preferences` (`channel`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notification_preferences_event_type` ON `notification_preferences` (`eventType`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_notification_preferences_unique` ON `notification_preferences` (`userId`, `channel`, `eventType`);--> statement-breakpoint

-- Indexes for delivery_attempts
CREATE INDEX IF NOT EXISTS `idx_delivery_attempts_notification` ON `delivery_attempts` (`notificationId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_delivery_attempts_status` ON `delivery_attempts` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_delivery_attempts_channel` ON `delivery_attempts` (`channel`);
