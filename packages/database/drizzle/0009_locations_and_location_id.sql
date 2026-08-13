CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`siteType` text NOT NULL,
	`level1` text NOT NULL,
	`level2` text,
	`level3` text,
	`level4` text,
	`displayLabel` text NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`sortOrder` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `locationId` text;