ALTER TABLE `team_members` ADD COLUMN `userId` text REFERENCES `users`(`id`);--> statement-breakpoint
UPDATE `team_members`
SET `userId` = (
  SELECT `users`.`id`
  FROM `users`
  WHERE `users`.`email` = `team_members`.`email`
  LIMIT 1
)
WHERE `userId` IS NULL
  AND `email` IS NOT NULL
  AND trim(`email`) <> '';--> statement-breakpoint
UPDATE `team_members`
SET `userId` = (
  SELECT `users`.`id`
  FROM `users`
  WHERE `users`.`name` = `team_members`.`name`
  LIMIT 1
)
WHERE `userId` IS NULL
  AND (
    SELECT count(*)
    FROM `users`
    WHERE `users`.`name` = `team_members`.`name`
  ) = 1;--> statement-breakpoint
UPDATE `team_members`
SET `userId` = 'bcea1e0f-b972-4f75-8563-c9f64aa9756f'
WHERE `userId` IS NULL
  AND `name` = 'Narayanan';--> statement-breakpoint

ALTER TABLE `audit_events` ADD COLUMN `siteId` text;--> statement-breakpoint
UPDATE `audit_events`
SET `siteId` = json_extract(`payload`, '$.siteId')
WHERE `siteId` IS NULL
  AND json_extract(`payload`, '$.siteId') IS NOT NULL;--> statement-breakpoint

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_update_ai_outputs` (
  `id` text PRIMARY KEY NOT NULL,
  `updateId` text NOT NULL UNIQUE,
  `category` text NOT NULL,
  `departmentCode` text REFERENCES `departments`(`code`),
  `location` text,
  `locationId` text NOT NULL REFERENCES `locations`(`id`),
  `blockerSubtype` text,
  `locationBlock` text,
  `locationZone` text,
  `locationLevel` text,
  `locationArea` text,
  `vendor` text,
  `severity` text NOT NULL,
  `ownerRoleCode` text NOT NULL REFERENCES `role_types`(`code`),
  `ownerId` text,
  `dueDate` text NOT NULL,
  `generatedTaskDescription` text NOT NULL,
  `riskImpact` text NOT NULL,
  `scheduleRisk` text NOT NULL,
  `confidence` real NOT NULL,
  `reviewRequired` integer NOT NULL DEFAULT 0,
  `reviewPrompt` text,
  `reviewReasonsJson` text NOT NULL DEFAULT '[]',
  `reviewFieldsJson` text NOT NULL DEFAULT '[]',
  `humanReviewRequired` integer NOT NULL DEFAULT 0,
  `reviewStatus` text NOT NULL DEFAULT 'pending',
  `reviewedAt` text,
  `reviewedBy` text,
  `suggestedSnapshotJson` text
);--> statement-breakpoint
INSERT INTO `__new_update_ai_outputs` (
  `id`,
  `updateId`,
  `category`,
  `departmentCode`,
  `location`,
  `locationId`,
  `blockerSubtype`,
  `locationBlock`,
  `locationZone`,
  `locationLevel`,
  `locationArea`,
  `vendor`,
  `severity`,
  `ownerRoleCode`,
  `ownerId`,
  `dueDate`,
  `generatedTaskDescription`,
  `riskImpact`,
  `scheduleRisk`,
  `confidence`,
  `reviewRequired`,
  `reviewPrompt`,
  `reviewReasonsJson`,
  `reviewFieldsJson`,
  `humanReviewRequired`,
  `reviewStatus`,
  `reviewedAt`,
  `reviewedBy`,
  `suggestedSnapshotJson`
)
SELECT
  `updateId` AS `id`,
  `updateId`,
  `category`,
  `departmentCode`,
  `location`,
  `locationId`,
  `blockerSubtype`,
  `locationBlock`,
  `locationZone`,
  `locationLevel`,
  `locationArea`,
  `vendor`,
  `severity`,
  `ownerRoleCode`,
  `ownerId`,
  `dueDate`,
  `generatedTaskDescription`,
  `riskImpact`,
  `scheduleRisk`,
  `confidence`,
  `reviewRequired`,
  `reviewPrompt`,
  `reviewReasonsJson`,
  `reviewFieldsJson`,
  `humanReviewRequired`,
  CASE
    WHEN `humanReviewRequired` = 1 THEN 'needs_human_review'
    WHEN `reviewRequired` = 1 THEN 'pending'
    ELSE 'accepted'
  END AS `reviewStatus`,
  `reviewedAt`,
  `reviewedBy`,
  `suggestedSnapshotJson`
FROM `update_ai_outputs`;--> statement-breakpoint
DROP TABLE `update_ai_outputs`;--> statement-breakpoint
ALTER TABLE `__new_update_ai_outputs` RENAME TO `update_ai_outputs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
