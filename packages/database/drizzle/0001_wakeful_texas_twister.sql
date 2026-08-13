CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurredAt` text NOT NULL,
	`eventType` text NOT NULL,
	`projectId` text,
	`entityType` text NOT NULL,
	`entityId` text NOT NULL,
	`actor` text,
	`payload` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `humanReviewRequired` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `reviewedAt` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `reviewedBy` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `suggestedSnapshotJson` text;--> statement-breakpoint
ALTER TABLE `updates` ADD `transcribeIdempotencyKey` text;--> statement-breakpoint
ALTER TABLE `updates` ADD `extractIdempotencyKey` text;