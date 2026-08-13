ALTER TABLE `update_ai_outputs` ADD `reviewRequired` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `reviewPrompt` text;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `reviewReasonsJson` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `reviewFieldsJson` text DEFAULT '[]' NOT NULL;