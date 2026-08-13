-- Canonical relational org codes (FK to departments.code / role_types.code) + location backfill + NOT NULL locationId.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

-- =============================================================================
-- users: orgRoleCode, departmentCode; drop legacy role / department / orgRole
-- =============================================================================
ALTER TABLE `users` ADD `orgRoleCode` text REFERENCES `role_types`(`code`);
--> statement-breakpoint
ALTER TABLE `users` ADD `departmentCode` text REFERENCES `departments`(`code`);
--> statement-breakpoint

UPDATE `users` SET `orgRoleCode` = CASE trim(COALESCE(`orgRole`, ''))
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'DepartmentSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'Engineer' THEN 'ENGINEER'
  WHEN 'Foreman' THEN 'FOREMAN'
  WHEN 'Technician' THEN 'TECHNICIAN'
  WHEN 'Worker' THEN 'WORKER'
  ELSE NULL
END
WHERE trim(COALESCE(`orgRole`, '')) != '';
--> statement-breakpoint

UPDATE `users` SET `orgRoleCode` = CASE trim(`role`)
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'MasonLead' THEN 'FOREMAN'
  WHEN 'ProcurementLead' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'ElectricalSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'PaintingContractor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'CivilEngineer' THEN 'ENGINEER'
  WHEN 'SteelFixer' THEN 'WORKER'
  WHEN 'Electrician' THEN 'TECHNICIAN'
  WHEN 'Plumber' THEN 'TECHNICIAN'
  WHEN 'Carpenter' THEN 'WORKER'
  ELSE 'WORKER'
END
WHERE `orgRoleCode` IS NULL OR `orgRoleCode` = '';
--> statement-breakpoint

UPDATE `users` SET `departmentCode` = NULLIF(trim(`department`), '')
WHERE trim(COALESCE(`department`, '')) != '';
--> statement-breakpoint

UPDATE `users` SET `departmentCode` = CASE trim(`role`)
  WHEN 'MasonLead' THEN 'Masonry'
  WHEN 'ProcurementLead' THEN 'Procurement'
  WHEN 'ElectricalSupervisor' THEN 'Electrical'
  WHEN 'PaintingContractor' THEN 'Finishing'
  WHEN 'CivilEngineer' THEN 'Civil'
  WHEN 'SteelFixer' THEN 'Steel'
  WHEN 'Electrician' THEN 'Electrical'
  WHEN 'Plumber' THEN 'Plumbing'
  WHEN 'Carpenter' THEN 'Carpentry'
  ELSE NULL
END
WHERE (`departmentCode` IS NULL OR `departmentCode` = '') AND trim(COALESCE(`department`, '')) = '';
--> statement-breakpoint

UPDATE `users` SET `orgRoleCode` = 'WORKER' WHERE `orgRoleCode` IS NULL OR trim(`orgRoleCode`) = '';
--> statement-breakpoint

ALTER TABLE `users` DROP COLUMN `role`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `department`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `orgRole`;
--> statement-breakpoint

-- =============================================================================
-- team_members
-- =============================================================================
ALTER TABLE `team_members` ADD `orgRoleCode` text REFERENCES `role_types`(`code`);
--> statement-breakpoint
ALTER TABLE `team_members` ADD `departmentCode` text REFERENCES `departments`(`code`);
--> statement-breakpoint

UPDATE `team_members` SET `orgRoleCode` = CASE trim(COALESCE(`orgRole`, ''))
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'DepartmentSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'Engineer' THEN 'ENGINEER'
  WHEN 'Foreman' THEN 'FOREMAN'
  WHEN 'Technician' THEN 'TECHNICIAN'
  WHEN 'Worker' THEN 'WORKER'
  ELSE NULL
END
WHERE trim(COALESCE(`orgRole`, '')) != '';
--> statement-breakpoint

UPDATE `team_members` SET `orgRoleCode` = CASE trim(`role`)
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'MasonLead' THEN 'FOREMAN'
  WHEN 'ProcurementLead' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'ElectricalSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'PaintingContractor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'CivilEngineer' THEN 'ENGINEER'
  WHEN 'SteelFixer' THEN 'WORKER'
  WHEN 'Electrician' THEN 'TECHNICIAN'
  WHEN 'Plumber' THEN 'TECHNICIAN'
  WHEN 'Carpenter' THEN 'WORKER'
  ELSE 'WORKER'
END
WHERE `orgRoleCode` IS NULL OR `orgRoleCode` = '';
--> statement-breakpoint

UPDATE `team_members` SET `departmentCode` = NULLIF(trim(`department`), '')
WHERE trim(COALESCE(`department`, '')) != '';
--> statement-breakpoint

UPDATE `team_members` SET `departmentCode` = CASE trim(`role`)
  WHEN 'MasonLead' THEN 'Masonry'
  WHEN 'ProcurementLead' THEN 'Procurement'
  WHEN 'ElectricalSupervisor' THEN 'Electrical'
  WHEN 'PaintingContractor' THEN 'Finishing'
  WHEN 'CivilEngineer' THEN 'Civil'
  WHEN 'SteelFixer' THEN 'Steel'
  WHEN 'Electrician' THEN 'Electrical'
  WHEN 'Plumber' THEN 'Plumbing'
  WHEN 'Carpenter' THEN 'Carpentry'
  ELSE NULL
END
WHERE (`departmentCode` IS NULL OR `departmentCode` = '') AND trim(COALESCE(`department`, '')) = '';
--> statement-breakpoint

UPDATE `team_members` SET `orgRoleCode` = 'WORKER' WHERE `orgRoleCode` IS NULL OR trim(`orgRoleCode`) = '';
--> statement-breakpoint

ALTER TABLE `team_members` DROP COLUMN `role`;
--> statement-breakpoint
ALTER TABLE `team_members` DROP COLUMN `department`;
--> statement-breakpoint
ALTER TABLE `team_members` DROP COLUMN `orgRole`;
--> statement-breakpoint

-- =============================================================================
-- tasks: assigneeRoleCode, departmentCode; drop assigneeRole, department
-- =============================================================================
ALTER TABLE `tasks` ADD `assigneeRoleCode` text REFERENCES `role_types`(`code`);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `departmentCode` text REFERENCES `departments`(`code`);
--> statement-breakpoint

UPDATE `tasks` SET `assigneeRoleCode` = CASE trim(`assigneeRole`)
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'MasonLead' THEN 'FOREMAN'
  WHEN 'ProcurementLead' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'ElectricalSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'PaintingContractor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'CivilEngineer' THEN 'ENGINEER'
  WHEN 'SteelFixer' THEN 'WORKER'
  WHEN 'Electrician' THEN 'TECHNICIAN'
  WHEN 'Plumber' THEN 'TECHNICIAN'
  WHEN 'Carpenter' THEN 'WORKER'
  ELSE 'WORKER'
END;
--> statement-breakpoint

UPDATE `tasks` SET `departmentCode` = NULLIF(trim(`department`), '')
WHERE trim(COALESCE(`department`, '')) != '';
--> statement-breakpoint

ALTER TABLE `tasks` DROP COLUMN `assigneeRole`;
--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `department`;
--> statement-breakpoint

-- =============================================================================
-- update_ai_outputs: ownerRoleCode, departmentCode; drop ownerRole, department
-- =============================================================================
ALTER TABLE `update_ai_outputs` ADD `ownerRoleCode` text REFERENCES `role_types`(`code`);
--> statement-breakpoint
ALTER TABLE `update_ai_outputs` ADD `departmentCode` text REFERENCES `departments`(`code`);
--> statement-breakpoint

UPDATE `update_ai_outputs` SET `ownerRoleCode` = CASE trim(`ownerRole`)
  WHEN 'SiteManager' THEN 'SITE_MANAGER'
  WHEN 'SiteSupervisor' THEN 'SITE_SUPERVISOR'
  WHEN 'MasonLead' THEN 'FOREMAN'
  WHEN 'ProcurementLead' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'ElectricalSupervisor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'PaintingContractor' THEN 'DEPARTMENT_SUPERVISOR'
  WHEN 'CivilEngineer' THEN 'ENGINEER'
  WHEN 'SteelFixer' THEN 'WORKER'
  WHEN 'Electrician' THEN 'TECHNICIAN'
  WHEN 'Plumber' THEN 'TECHNICIAN'
  WHEN 'Carpenter' THEN 'WORKER'
  ELSE 'WORKER'
END;
--> statement-breakpoint

UPDATE `update_ai_outputs` SET `departmentCode` = NULLIF(trim(`department`), '')
WHERE trim(COALESCE(`department`, '')) != '';
--> statement-breakpoint

ALTER TABLE `update_ai_outputs` DROP COLUMN `ownerRole`;
--> statement-breakpoint
ALTER TABLE `update_ai_outputs` DROP COLUMN `department`;
--> statement-breakpoint

-- =============================================================================
-- Location backfill (nullable → required)
-- =============================================================================
UPDATE `updates` SET `locationId` = (
  SELECT `a`.`locationId` FROM `update_ai_outputs` `a`
  WHERE `a`.`updateId` = `updates`.`id` AND `a`.`locationId` IS NOT NULL AND trim(`a`.`locationId`) != ''
  LIMIT 1
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

UPDATE `updates` SET `locationId` = (
  SELECT `t`.`locationId` FROM `tasks` `t`
  WHERE `t`.`sourceUpdateId` = `updates`.`id` AND `t`.`locationId` IS NOT NULL AND trim(`t`.`locationId`) != ''
  LIMIT 1
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

UPDATE `updates` SET `locationId` = (
  SELECT `l`.`id` FROM `locations` `l`
  WHERE `l`.`projectId` = `updates`.`projectId`
  ORDER BY `l`.`sortOrder` ASC
  LIMIT 1
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

UPDATE `update_ai_outputs` SET `locationId` = (
  SELECT `u`.`locationId` FROM `updates` `u` WHERE `u`.`id` = `update_ai_outputs`.`updateId`
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

UPDATE `update_ai_outputs` SET `locationId` = (
  SELECT `l`.`id` FROM `locations` `l`
  INNER JOIN `updates` `u` ON `u`.`projectId` = `l`.`projectId`
  WHERE `u`.`id` = `update_ai_outputs`.`updateId`
  ORDER BY `l`.`sortOrder` ASC
  LIMIT 1
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

UPDATE `tasks` SET `locationId` = (
  SELECT `u`.`locationId` FROM `updates` `u` WHERE `u`.`id` = `tasks`.`sourceUpdateId`
)
WHERE (`locationId` IS NULL OR trim(`locationId`) = '') AND `sourceUpdateId` IS NOT NULL AND trim(`sourceUpdateId`) != '';
--> statement-breakpoint

UPDATE `tasks` SET `locationId` = (
  SELECT `l`.`id` FROM `locations` `l`
  WHERE `l`.`projectId` = `tasks`.`projectId`
  ORDER BY `l`.`sortOrder` ASC
  LIMIT 1
)
WHERE `locationId` IS NULL OR trim(`locationId`) = '';
--> statement-breakpoint

-- Rebuild tables with NOT NULL locationId + FK (SQLite cannot ALTER COLUMN to NOT NULL safely)
CREATE TABLE `updates__new` (
  `id` text PRIMARY KEY NOT NULL,
  `siteId` text NOT NULL,
  `projectId` text NOT NULL,
  `recordedBy` text NOT NULL,
  `transcript` text NOT NULL,
  `audioUrl` text,
  `audioDuration` text,
  `status` text NOT NULL,
  `isRead` integer NOT NULL DEFAULT 0,
  `readAt` text,
  `transcribeIdempotencyKey` text,
  `extractIdempotencyKey` text,
  `linkedTaskId` text,
  `locationId` text NOT NULL REFERENCES `locations`(`id`),
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL
);
--> statement-breakpoint

INSERT INTO `updates__new` SELECT
  `id`, `siteId`, `projectId`, `recordedBy`, `transcript`, `audioUrl`, `audioDuration`, `status`,
  COALESCE(`isRead`, 0), `readAt`, `transcribeIdempotencyKey`, `extractIdempotencyKey`, `linkedTaskId`,
  `locationId`, `createdAt`, `updatedAt`
FROM `updates`;
--> statement-breakpoint

DROP TABLE `updates`;
--> statement-breakpoint
ALTER TABLE `updates__new` RENAME TO `updates`;
--> statement-breakpoint

CREATE TABLE `update_ai_outputs__new` (
  `updateId` text PRIMARY KEY NOT NULL,
  `category` text NOT NULL,
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
  `reviewedAt` text,
  `reviewedBy` text,
  `suggestedSnapshotJson` text,
  `departmentCode` text REFERENCES `departments`(`code`)
);
--> statement-breakpoint

INSERT INTO `update_ai_outputs__new` SELECT
  `updateId`, `category`, `location`, `locationId`, `blockerSubtype`, `locationBlock`, `locationZone`, `locationLevel`, `locationArea`,
  `vendor`, `severity`, `ownerRoleCode`, `ownerId`, `dueDate`, `generatedTaskDescription`, `riskImpact`, `scheduleRisk`, `confidence`,
  `reviewRequired`, `reviewPrompt`, `reviewReasonsJson`, `reviewFieldsJson`, `humanReviewRequired`, `reviewedAt`, `reviewedBy`, `suggestedSnapshotJson`,
  `departmentCode`
FROM `update_ai_outputs`;
--> statement-breakpoint

DROP TABLE `update_ai_outputs`;
--> statement-breakpoint
ALTER TABLE `update_ai_outputs__new` RENAME TO `update_ai_outputs`;
--> statement-breakpoint

CREATE TABLE `tasks__new` (
  `id` text PRIMARY KEY NOT NULL,
  `siteId` text NOT NULL,
  `projectId` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `ownerId` text NOT NULL,
  `severity` text NOT NULL,
  `createdBy` text,
  `updatedBy` text,
  `location` text NOT NULL,
  `locationId` text NOT NULL REFERENCES `locations`(`id`),
  `status` text NOT NULL,
  `source` text NOT NULL,
  `sourceUpdateId` text,
  `startDate` text NOT NULL,
  `dueDate` text NOT NULL,
  `completedAt` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `assigneeRoleCode` text NOT NULL REFERENCES `role_types`(`code`),
  `departmentCode` text REFERENCES `departments`(`code`)
);
--> statement-breakpoint

INSERT INTO `tasks__new` SELECT
  `id`, `siteId`, `projectId`, `title`, `description`, `ownerId`, `severity`, `createdBy`, `updatedBy`, `location`, `locationId`,
  `status`, `source`, `sourceUpdateId`, `startDate`, `dueDate`, `completedAt`, `createdAt`, `updatedAt`,
  `assigneeRoleCode`, `departmentCode`
FROM `tasks`;
--> statement-breakpoint

DROP TABLE `tasks`;
--> statement-breakpoint
ALTER TABLE `tasks__new` RENAME TO `tasks`;
--> statement-breakpoint

PRAGMA foreign_keys = ON;
