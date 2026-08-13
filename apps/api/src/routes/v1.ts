import { count } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { projects, tasks, updates, users } from "@v2e/database";

import { getDemoDb } from "../db.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { projectsRouter } from "./projects.js";
import { updatesEntryRouter } from "./updates-router.js";
import { updateActionsRouter } from "./update-actions.js";
import { dashboardRouter } from "./dashboard.js";
import { standupPrepRouter } from "./standup-prep.js";
import { aiJobsRouter } from "./ai-jobs.js";
import { reviewsRouter } from "./reviews.js";
import { tasksFlatRouter } from "./tasks-flat.js";
import { auditRouter } from "./audit.js";

// Phase B — one mount per resource under `/v1/<entity>` (no duplicate `/projects` + `/` mounts)
import { cyclesRouter } from "./cycles.js";
import { commitmentsRouter } from "./commitments.js";
import { dependenciesRouter } from "./dependencies.js";

// Phase C — entity routes + technical reviews (task commands) at `/v1/tasks/...`
import { improvementsRouter } from "./improvements.js";
import { taskReviewsRouter } from "./task-reviews.js";
import { metricsRouter } from "./metrics.js";

// Phase D
import { standupsRouter } from "./standups.js";
import { notificationsRouter } from "./notifications.js";

// Phase E — platform entity CRUD
import { usersRouter } from "./users.js";
import { departmentsRouter } from "./departments.js";
import { rolesRouter } from "./roles.js";
import { locationsRouter } from "./locations.js";
import { sitesRouter } from "./sites.js";
import { membersRouter } from "./members.js";

// Phase G
import { filesRouter } from "./files.js";
import { updateExtractionRouter } from "./update-extraction.js";
import { attachmentsRouter } from "./attachments.js";

const v1 = new Hono();

// Projects: list + CRUD (nested read models removed — use flat routes below)
v1.route("/projects", projectsRouter);

// Dashboard + standup + updates: flat routes (`?projectId=` / multipart POST)
v1.route("/dashboard", dashboardRouter);
v1.route("/standup-prep", standupPrepRouter);
v1.route("/ai", aiJobsRouter);
v1.route("/reviews", reviewsRouter);
v1.route("/updates", updatesEntryRouter);
v1.route("/updates", updateActionsRouter);

// Mount tasks router (Phase F - flat routes per §12.12)
v1.route("/tasks", tasksFlatRouter);
v1.route("/tasks", taskReviewsRouter);

// Phase B: entity roots only
v1.route("/cycles", cyclesRouter);
v1.route("/commitments", commitmentsRouter);
v1.route("/dependencies", dependenciesRouter);

// Phase C: entity routes only
v1.route("/improvements", improvementsRouter);
v1.route("/metrics", metricsRouter);

// Phase D: standups, notifications, attendance, AI summaries
v1.route("/standups", standupsRouter);
v1.route("/notifications", notificationsRouter);

// Phase E: Platform entity CRUD (flat routes)
v1.route("/users", usersRouter);
v1.route("/departments", departmentsRouter);
v1.route("/roles", rolesRouter);
v1.route("/locations", locationsRouter);
v1.route("/sites", sitesRouter);
v1.route("/members", membersRouter);

// Phase G: Files, attachments, AI outputs (flat routes)
v1.route("/files", filesRouter);
v1.route("/attachments", attachmentsRouter);
v1.route("/updates", updateExtractionRouter);

// Phase H: Audit events (flat route per §12.23)
v1.route("/audit", auditRouter);

function dbNotReady(c: Context) {
  const sqlitePath = resolveSqlitePath();
  return c.json(
    {
      error: {
        code: "DB_NOT_FOUND",
        message:
          "Demo SQLite file is missing. Seed it from the repo root: pnpm --filter @v2e/database db:seed",
        details: { path: sqlitePath },
      },
    },
    503
  );
}

v1.get("/", (c) =>
  c.json({
    ok: true,
    name: "v2e-api",
    version: "v1",
    demo: true,
    auth: "bearer",
    docs: "Pilot platform: Bearer token auth required for mutations (POST/PATCH). GET routes are public.",
  })
);

v1.get("/ping", (c) =>
  c.json({ pong: true, timestamp: new Date().toISOString() })
);

/** Demo-only: table row counts (no auth). */
v1.get("/debug/db-summary", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const [userCount] = await db.select({ n: count() }).from(users);
  const [projectCount] = await db.select({ n: count() }).from(projects);
  const [taskCount] = await db.select({ n: count() }).from(tasks);
  const [updateCount] = await db.select({ n: count() }).from(updates);
  return c.json({
    sqlitePath: resolveSqlitePath(),
    counts: {
      users: userCount.n,
      projects: projectCount.n,
      tasks: taskCount.n,
      updates: updateCount.n,
    },
  });
});

export { v1 };
