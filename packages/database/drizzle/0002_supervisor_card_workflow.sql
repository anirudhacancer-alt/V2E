ALTER TABLE `updates` ADD `isRead` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `updates` ADD `readAt` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `blockerSubtype` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `locationBlock` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `locationZone` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `locationLevel` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `locationArea` text;
