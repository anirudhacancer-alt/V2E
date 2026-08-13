-- §17: Notification delivery infrastructure tables
-- email_queue, push_queue, device_tokens for the notification pipeline

-- Email queue - staging table for outbound emails
CREATE TABLE `email_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`notificationId` text REFERENCES `notifications`(`id`),
	`toEmail` text NOT NULL,
	`ccEmails` text,
	`subject` text NOT NULL,
	`bodyText` text NOT NULL,
	`bodyHtml` text,
	`templateId` text,
	`templateVars` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`nextAttemptAt` text,
	`sentAt` text,
	`providerMessageId` text,
	`lastError` text,
	`createdAt` text NOT NULL
);--> statement-breakpoint

-- Push notification queue - staging table for mobile push notifications
CREATE TABLE `push_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`notificationId` text REFERENCES `notifications`(`id`),
	`userId` text NOT NULL REFERENCES `users`(`id`),
	`deviceToken` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`badge` integer,
	`sound` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`nextAttemptAt` text,
	`sentAt` text,
	`providerMessageId` text,
	`lastError` text,
	`createdAt` text NOT NULL
);--> statement-breakpoint

-- Device tokens - user device registration for push notifications
CREATE TABLE `device_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`userId` text NOT NULL REFERENCES `users`(`id`),
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`deviceInfo` text,
	`appVersion` text,
	`isActive` integer DEFAULT 1 NOT NULL,
	`lastUsedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
