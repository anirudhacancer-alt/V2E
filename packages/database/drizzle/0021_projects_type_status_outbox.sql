-- §8.2 / §12.6: project type + lifecycle status for list filters
ALTER TABLE `projects` ADD COLUMN `type` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint

-- §17: transactional outbox for notification / delivery pipeline
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`eventType` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`nextAttemptAt` text,
	`processedAt` text,
	`lastError` text,
	`createdAt` text NOT NULL
);
