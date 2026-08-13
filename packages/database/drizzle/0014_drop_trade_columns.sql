-- Hard cut: remove legacy `trade`; `department` is the only discipline field.
ALTER TABLE `tasks` DROP COLUMN `trade`;
--> statement-breakpoint
ALTER TABLE `update_ai_outputs` DROP COLUMN `trade`;
