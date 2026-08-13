-- Cached AI standup summary per project (calendar day), so refresh does not re-call the LLM.
CREATE TABLE `project_standup_ai_summaries` (
  `projectId` text PRIMARY KEY NOT NULL,
  `id` text NOT NULL,
  `summaryDate` text NOT NULL,
  `summaryText` text NOT NULL,
  `modelUsed` text NOT NULL,
  `updatedAt` text NOT NULL
);
