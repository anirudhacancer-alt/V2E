/**
 * Flat standup prep read model — `GET /v1/standup-prep?projectId=`
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  projects,
  sites,
  tasks,
  teamMembers,
  roleTypes,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { resolvePersonNamesByIds } from "../lib/resolve-person.js";
import { deriveSupervisorTaskState } from "../lib/task-state.js";
import {
  standupPrepDateBounds,
  plannedForTodayTasks,
  completedYesterdayTasks,
  carryForwardDueYesterdayTasks,
} from "../lib/standup-prep-from-tasks.js";
import { assertNoUnresolvedMemberRoles } from "../lib/member-integrity.js";

const standupPrepRouter = new Hono();

function integrityErrorResponse(c: Context, e: DataIntegrityError) {
  opsLog("error", "data_integrity", {
    message: e.message,
    details: e.details,
  });
  return c.json(
    {
      error: {
        code: e.code,
        message: e.message,
        details: e.details ?? {},
      },
    },
    500
  );
}

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

standupPrepRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter is required",
        },
      },
      400
    );
  }

  const db = getDemoDb();
  const { todayYmd, yesterdayYmd } = standupPrepDateBounds();

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.id, project.siteId));

    if (!site) {
      throw new DataIntegrityError("project references missing site row", {
        projectId,
        siteId: project.siteId,
      });
    }

    await assertNoUnresolvedMemberRoles(db, site.id, { projectId });

    const siteMembers = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        orgRoleCode: teamMembers.orgRoleCode,
        roleTypeName: roleTypes.name,
        isActive: teamMembers.isActive,
      })
      .from(teamMembers)
      .innerJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
      .where(eq(teamMembers.siteId, site.id));

    const members = siteMembers.filter((m) => m.isActive === "true");

    const projectTaskRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        ownerId: tasks.ownerId,
        severity: tasks.severity,
        location: tasks.location,
        departmentCode: tasks.departmentCode,
        status: tasks.status,
        dueDate: tasks.dueDate,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const taskRowsFor = projectTaskRows.map((t) => ({
      id: t.id,
      projectId,
      title: t.title,
      description: t.description,
      ownerId: t.ownerId,
      severity: t.severity,
      department: t.departmentCode ?? null,
      location: t.location,
      status: t.status,
      dueDate: t.dueDate,
      completedAt: t.completedAt ?? null,
    }));

    const plannedTaskRows = plannedForTodayTasks(
      taskRowsFor,
      projectId,
      todayYmd,
    );
    const completedYesterdayTaskRows = completedYesterdayTasks(
      taskRowsFor,
      projectId,
      yesterdayYmd,
    );
    const carryForwardTaskRows = carryForwardDueYesterdayTasks(
      taskRowsFor,
      projectId,
      yesterdayYmd,
    );

    const blockedTasks = projectTaskRows.filter(
      (task) => deriveSupervisorTaskState(task) === "Blocked",
    );

    const standupOwnerIds = [
      ...blockedTasks.map((t) => t.ownerId),
      ...plannedTaskRows.map((t) => t.ownerId),
      ...completedYesterdayTaskRows.map((t) => t.ownerId),
      ...carryForwardTaskRows.map((t) => t.ownerId),
    ];
    const ownerNameById = await resolvePersonNamesByIds(db, standupOwnerIds);

    const activeBlockers = blockedTasks.map((t) => ({
      taskId: t.id,
      taskTitle: t.title,
      severity: t.severity,
      location: t.location || null,
      reason: t.description,
      ownerName: ownerNameById.get(t.ownerId)!,
    }));

    const expectedAttendees = members.map((m) => ({
      teamMemberId: m.id,
      name: m.name,
      orgRoleCode: m.orgRoleCode,
      roleTypeName: m.roleTypeName,
    }));

    const stats = {
      tasksActive: 0,
      tasksBlocked: 0,
      tasksCompleted: 0,
      overdueCount: 0,
    };

    projectTaskRows.forEach((task) => {
      const uiState = deriveSupervisorTaskState(task);
      if (uiState === "In-progress") stats.tasksActive += 1;
      if (uiState === "Blocked") stats.tasksBlocked += 1;
      if (uiState === "Overdue") stats.overdueCount += 1;
      if (task.status === "Done") stats.tasksCompleted += 1;
    });

    const plannedItemsResponse = plannedTaskRows.map((t) => ({
      id: t.id,
      description: t.title,
      location: t.location || null,
      department: t.department || null,
      linkedTaskId: t.id,
      ownerName: ownerNameById.get(t.ownerId)!,
    }));

    const yesterdayCompletedResponse = completedYesterdayTaskRows.map((t) => ({
      id: t.id,
      description: t.title,
      location: t.location || null,
      linkedTaskId: t.id,
      ownerName: ownerNameById.get(t.ownerId)!,
    }));

    const carryForwardDueYesterdayResponse = carryForwardTaskRows.map((t) => ({
      id: t.id,
      taskTitle: t.title,
      description: t.description,
      severity: t.severity,
      location: t.location || null,
      ownerName: ownerNameById.get(t.ownerId)!,
    }));

    return c.json({
      projectId: project.id,
      projectName: project.name,
      date: todayYmd,
      yesterdayCompleted: yesterdayCompletedResponse,
      carryForwardDueYesterday: carryForwardDueYesterdayResponse,
      plannedItems: plannedItemsResponse,
      lastStandup: null,
      activeBlockers,
      expectedAttendees,
      stats,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { standupPrepRouter };
