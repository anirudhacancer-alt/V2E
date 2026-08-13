-- Option B (phase 1): master tables + additive columns. Legacy `trade` / `role` retained.

CREATE TABLE `departments` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `category` text NOT NULL DEFAULT '',
  `isSiteFunction` integer NOT NULL DEFAULT 0,
  `isExecutionDiscipline` integer NOT NULL DEFAULT 0,
  `isActive` integer NOT NULL DEFAULT 1,
  `sortOrder` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `role_types` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `level` text NOT NULL DEFAULT '',
  `isManagerial` integer NOT NULL DEFAULT 0,
  `isFieldBased` integer NOT NULL DEFAULT 0,
  `isCrewRole` integer NOT NULL DEFAULT 0,
  `isActive` integer NOT NULL DEFAULT 1,
  `sortOrder` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE `users` ADD `department` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD `orgRole` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD `specialty` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `team_members` ADD `department` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `team_members` ADD `orgRole` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `team_members` ADD `specialty` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `team_members` ADD `reportsToUserId` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `department` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `createdBy` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `updatedBy` text;
--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `department` text;
--> statement-breakpoint
UPDATE `tasks` SET `department` = CASE `trade`
  WHEN 'RCC' THEN 'Structure'
  WHEN 'Concrete' THEN 'Structure'
  WHEN 'MEP' THEN 'MEP'
  WHEN 'Finishing' THEN 'Finishing'
  WHEN 'Procurement' THEN 'Procurement'
  WHEN 'Masonry' THEN 'Masonry'
  WHEN 'Electrical' THEN 'Electrical'
  WHEN 'Plumbing' THEN 'Plumbing'
  WHEN 'Carpentry' THEN 'Carpentry'
  WHEN 'Steel' THEN 'Steel'
  WHEN 'Painting' THEN 'Painting'
  ELSE COALESCE(NULLIF(`trade`, ''), '')
END
WHERE `department` IS NULL OR `department` = '';
--> statement-breakpoint
UPDATE `update_ai_outputs` SET `department` = CASE `trade`
  WHEN 'RCC' THEN 'Structure'
  WHEN 'Concrete' THEN 'Structure'
  WHEN 'MEP' THEN 'MEP'
  WHEN 'Finishing' THEN 'Finishing'
  WHEN 'Procurement' THEN 'Procurement'
  WHEN 'Masonry' THEN 'Masonry'
  WHEN 'Electrical' THEN 'Electrical'
  WHEN 'Plumbing' THEN 'Plumbing'
  WHEN 'Carpentry' THEN 'Carpentry'
  WHEN 'Steel' THEN 'Steel'
  WHEN 'Painting' THEN 'Painting'
  ELSE COALESCE(NULLIF(`trade`, ''), '')
END
WHERE `department` IS NULL OR `department` = '';
