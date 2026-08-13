#!/usr/bin/env node
/**
 * Loads contract CSV bundles from docs/demo/datasets into a SQLite file via Drizzle.
 * The CSVs are treated as content blueprints; date-sensitive fields are
 * materialized relative to today (or --anchor-date) during seeding.
 * Run from repo root: pnpm --filter @v2e/database db:seed
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { count } from "drizzle-orm";
import * as schema from "./schema.js";
import { openDemoDb } from "./db.js";
import {
  DEFAULT_CONTRACTS,
  resolveAnchorDate,
} from "./demo-seed/config.js";
import { loadDemoBundle } from "./demo-seed/csv-bundle.js";
import { materializeDemoBundle, materializePhaseBEntities } from "./demo-seed/materialize.js";
import {
  clearDemoDb,
  insertDemoBundle,
  insertWorkCycles,
  insertCommitments,
  insertTaskDependencies,
  insertImprovementActions,
  insertStandupSessions,
  insertNotifications,
} from "./demo-seed/persist.js";
import { validateMaterializedBundle, validatePhaseBFixtures } from "./demo-seed/validate.js";
import { generateImprovementActions, validatePhaseCFixtures } from "./demo-seed/phase-c-entities.js";
import { generateStandupSessions, generateNotifications, validatePhaseDFixtures } from "./demo-seed/phase-d-entities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

function parseArgs(argv: string[]) {
  let repoRoot = path.resolve(pkgRoot, "../..");
  let contracts = [...DEFAULT_CONTRACTS];
  let dbPath = path.join(pkgRoot, "data", "demo.sqlite");
  let anchorDateInput: string | undefined;

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--repo-root" && val) {
      repoRoot = path.resolve(val);
      i += 1;
    } else if (key === "--contracts" && val) {
      contracts = val
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      i += 1;
    } else if (key === "--db" && val) {
      dbPath = path.resolve(val);
      i += 1;
    } else if (key === "--anchor-date" && val) {
      anchorDateInput = val;
      i += 1;
    }
  }

  return { repoRoot, contracts, dbPath, anchorDateInput };
}

function formatMetricsLine(
  contractId: string,
  metrics: {
    taskStatusCounts: Record<
      "Review" | "New" | "Planned" | "In-progress" | "Blocked" | "Done",
      number
    >;
    noteStateCounts: Record<"Review" | "Linked" | "Escalated", number>;
    overdueTasks: number;
  }
) {
  return [
    `contract ${contractId}`,
    `tasks Rv:${metrics.taskStatusCounts.Review}`,
    `N:${metrics.taskStatusCounts.New}`,
    `P:${metrics.taskStatusCounts.Planned}`,
    `IP:${metrics.taskStatusCounts["In-progress"]}`,
    `B:${metrics.taskStatusCounts.Blocked}`,
    `D:${metrics.taskStatusCounts.Done}`,
    `overdue:${metrics.overdueTasks}`,
    `notes R:${metrics.noteStateCounts.Review}`,
    `L:${metrics.noteStateCounts.Linked}`,
    `E:${metrics.noteStateCounts.Escalated}`,
  ].join(" | ");
}

function formatPhaseBMetricsLine(metrics: {
  workCycleCount: number;
  commitmentCount: number;
  dependencyCount: number;
}) {
  return `Phase B: cycles:${metrics.workCycleCount} | commitments:${metrics.commitmentCount} | dependencies:${metrics.dependencyCount}`;
}

function formatPhaseCMetricsLine(metrics: {
  improvementActionCount: number;
  overdueCount: number;
  linkedTaskCount: number;
}) {
  return `Phase C: improvements:${metrics.improvementActionCount} | overdue:${metrics.overdueCount} | linked-tasks:${metrics.linkedTaskCount}`;
}

function formatPhaseDMetricsLine(metrics: {
  standupSessionCount: number;
  notificationCount: number;
  unreadCount: number;
}) {
  return `Phase D: standup-sessions:${metrics.standupSessionCount} | notifications:${metrics.notificationCount} | unread:${metrics.unreadCount}`;
}

async function main() {
  const { repoRoot, contracts, dbPath, anchorDateInput } = parseArgs(process.argv);
  const anchorDate = resolveAnchorDate(anchorDateInput);
  const tenantId = "demo-tenant";

  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  for (const candidate of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      await fs.unlink(candidate);
    } catch {
      // ignore missing file
    }
  }

  const db = openDemoDb(dbPath);
  const migrationsFolder = path.join(pkgRoot, "drizzle");
  await migrate(db, { migrationsFolder });
  await clearDemoDb(db);

  // Track all materialized bundles for Phase B/C/D generation
  const allMaterialized: Array<{
    bundle: Awaited<ReturnType<typeof materializeDemoBundle>>;
    contractId: string;
  }> = [];

  for (const contractId of contracts) {
    console.log(
      `Seeding ${contractId} relative to ${anchorDate.toISOString().slice(0, 10)}...`
    );
    const bundle = await loadDemoBundle(repoRoot, contractId);
    const materialized = materializeDemoBundle(bundle, anchorDate);
    validateMaterializedBundle(materialized, anchorDate);
    await insertDemoBundle(db, materialized);
    console.log(formatMetricsLine(contractId, materialized.metrics));
    allMaterialized.push({ bundle: materialized, contractId });
  }

  // ============================================================================
  // Phase B: Generate and insert work cycles, commitments, task dependencies
  // ============================================================================
  console.log("\nGenerating Phase B entities...");

  for (const { bundle, contractId } of allMaterialized) {
    const seed = `${bundle.datasetKey}:${anchorDate.toISOString().slice(0, 10)}`;
    const phaseBEntities = materializePhaseBEntities(bundle, anchorDate);

    // Validate Phase B fixtures
    const phaseBErrors = validatePhaseBFixtures(
      phaseBEntities.workCycles,
      phaseBEntities.commitments,
      phaseBEntities.taskDependencies,
      bundle.rows.tasks.map((t) => ({ id: t.id, projectId: t.projectId }))
    );
    if (phaseBErrors.length > 0) {
      console.warn(`Phase B validation warnings for ${contractId}: ${phaseBErrors.join("; ")}`);
    }

    // Insert Phase B entities
    await insertWorkCycles(db, phaseBEntities.workCycles);
    await insertCommitments(db, phaseBEntities.commitments);
    await insertTaskDependencies(db, phaseBEntities.taskDependencies);

    console.log(`  ${contractId}: ${formatPhaseBMetricsLine({
      workCycleCount: phaseBEntities.workCycles.length,
      commitmentCount: phaseBEntities.commitments.length,
      dependencyCount: phaseBEntities.taskDependencies.length,
    })}`);

    // ============================================================================
    // Phase C: Generate and insert improvement actions
    // ============================================================================
    const allImprovementActions = [];

    for (const project of bundle.rows.projects) {
      const projectCommitments = phaseBEntities.commitments.filter(
        (c) => c.projectId === project.id
      );

      const improvementActions = generateImprovementActions(
        bundle.rows.tasks,
        projectCommitments,
        bundle.rows.teamMembers,
        project.id,
        project.siteId,
        tenantId,
        anchorDate,
        seed
      );
      allImprovementActions.push(...improvementActions);
    }

    // Validate Phase C fixtures
    const phaseCErrors = validatePhaseCFixtures(
      allImprovementActions,
      bundle.rows.tasks.map((t) => ({ id: t.id, projectId: t.projectId })),
      phaseBEntities.commitments.map((c) => ({ id: c.id, projectId: c.projectId })),
      bundle.rows.teamMembers.map((tm) => ({ id: tm.id })),
      anchorDate
    );
    if (phaseCErrors.length > 0) {
      console.warn(`Phase C validation warnings for ${contractId}: ${phaseCErrors.join("; ")}`);
    }

    await insertImprovementActions(db, allImprovementActions);

    const overdueCount = allImprovementActions.filter((a) => {
      if (!["open", "in_progress"].includes(a.status) || !a.targetDate) return false;
      return new Date(a.targetDate).getTime() < anchorDate.getTime();
    }).length;

    const linkedTaskCount = allImprovementActions.filter((a) => {
      try {
        const linked = JSON.parse(a.linkedTaskIdsJson);
        return Array.isArray(linked) && linked.length > 0;
      } catch {
        return false;
      }
    }).length;

    console.log(`  ${contractId}: ${formatPhaseCMetricsLine({
      improvementActionCount: allImprovementActions.length,
      overdueCount,
      linkedTaskCount,
    })}`);

    // ============================================================================
    // Phase D: Generate and insert standup sessions and notifications
    // ============================================================================
    const allStandupSessions = [];

    for (const project of bundle.rows.projects) {
      const standupSessions = generateStandupSessions(
        bundle.rows.teamMembers,
        project.id,
        project.siteId,
        tenantId,
        anchorDate,
        seed
      );
      allStandupSessions.push(...standupSessions);
    }

    const notifications = generateNotifications(
      bundle.rows.users,
      bundle.rows.tasks,
      tenantId,
      anchorDate,
      seed
    );

    // Validate Phase D fixtures
    const phaseDErrors = validatePhaseDFixtures(
      allStandupSessions,
      notifications,
      bundle.rows.teamMembers.map((tm) => ({ id: tm.id })),
      bundle.rows.users.map((u) => ({ id: u.id })),
      bundle.rows.projects.map((p) => ({ id: p.id }))
    );
    if (phaseDErrors.length > 0) {
      console.warn(`Phase D validation warnings for ${contractId}: ${phaseDErrors.join("; ")}`);
    }

    await insertStandupSessions(db, allStandupSessions);
    await insertNotifications(db, notifications);

    const unreadCount = notifications.filter((n) => n.status === "unread").length;

    console.log(`  ${contractId}: ${formatPhaseDMetricsLine({
      standupSessionCount: allStandupSessions.length,
      notificationCount: notifications.length,
      unreadCount,
    })}`);
  }

  const [userRow] = await db.select({ n: count() }).from(schema.users);
  const [taskRow] = await db.select({ n: count() }).from(schema.tasks);
  const [iaRow] = await db.select({ n: count() }).from(schema.improvementActions);
  const [ssRow] = await db.select({ n: count() }).from(schema.standupSessions);
  const [notifRow] = await db.select({ n: count() }).from(schema.notifications);

  console.log(
    `\nDone. Database at ${dbPath}`
  );
  console.log(
    `  ${userRow.n} users, ${taskRow.n} tasks, ${iaRow.n} improvement actions, ${ssRow.n} standup sessions, ${notifRow.n} notifications`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
