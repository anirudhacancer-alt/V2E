#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  AttendanceSessionSchema,
  AttendanceSchema,
  normalizeReviewRequirement,
  ProjectSchema,
  SiteSchema,
  TaskSchema,
  TeamMemberSchema,
  UpdateSchema,
  UserSchema,
} from "../../../packages/contracts/dist/index.js";
import {
  validateLocationMasterRows,
  validateTaskAndAiLocationLinks,
  validateUpdateLocationLinks,
} from "../../../packages/database/dist/demo-seed/location-rules.js";
import {
  resolveDemoDatasetPack,
  KNOWN_DATASET_KEYS_BY_CONTRACT,
} from "../../../packages/database/dist/demo-seed/domain-packs.js";
import {
  departmentStringToCode,
  legacyUserRoleStringToRoleTypeCode,
} from "../../../packages/database/dist/org-canonical.js";

/** UTC calendar day (YYYY-MM-DD) for standup/task date alignment (matches `standup-aggregates.ts`). */
function utcYmd(iso) {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseArgs(argv) {
  const args = {
    repoRoot: process.cwd(),
    contracts: ["1328", "1330"],
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--repo-root" && val) {
      args.repoRoot = val;
      i += 1;
    } else if (key === "--contracts" && val) {
      args.contracts = val.split(",").map((v) => v.trim()).filter(Boolean);
      i += 1;
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((r) => !(r.length === 1 && r[0] === ""))
    .map((r) =>
      Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()]))
    );
}

async function readCsv(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return parseCsv(content);
}

function optionalString(v) {
  return v === "" ? undefined : v;
}

function parseStringArrayJson(v, field) {
  if (!v || v.trim() === "") return [];
  try {
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new Error("Expected JSON string array");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON array for ${field}: ${v} (${error.message})`);
  }
}

function parseDate(v, field) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for ${field}: ${v}`);
  }
  return d;
}

function parseNumber(v, field) {
  const n = Number(v);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid number for ${field}: ${v}`);
  }
  return n;
}

function parseBoolean(v, field) {
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`Invalid boolean for ${field}: ${v}`);
}

function normalizeUpdateStatus(value) {
  return value === "ConvertedToTask" ? "CreatedNewTask" : value;
}

/** Folder under docs/demo/datasets (project codes), e.g. RES-1328, COM-1330 */
function datasetDirectoryName(contractId) {
  if (KNOWN_DATASET_KEYS_BY_CONTRACT[contractId]) {
    return KNOWN_DATASET_KEYS_BY_CONTRACT[contractId];
  }
  return `contract-${contractId}`;
}

/** When CSV omits updatedAt, treat as createdAt (matches seed.ts). */
function coalesceUpdatedAtIso(r, createdAtKey = "createdAt") {
  const u = r.updatedAt?.trim();
  return u && u !== "" ? u : r[createdAtKey];
}

async function resolveDatasetDir(repoRoot, contractId) {
  const primary = path.join(
    repoRoot,
    "docs",
    "demo",
    "datasets",
    datasetDirectoryName(contractId)
  );
  const legacy = path.join(
    repoRoot,
    "docs",
    "demo",
    "datasets",
    `contract-${contractId}`
  );
  for (const dir of [primary, legacy]) {
    try {
      await fs.access(path.join(dir, "projects.csv"));
      return dir;
    } catch {
      // try alternate layout
    }
  }
  return primary;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

function buildError(err, rowIndex) {
  if (!err?.issues) return `row ${rowIndex}: unknown parse error`;
  return err.issues
    .slice(0, 3)
    .map((i) => `row ${rowIndex}: ${i.path.join(".")} - ${i.message}`)
    .join("; ");
}

function validateRows(name, schema, objects) {
  const errors = [];
  objects.forEach((obj, idx) => {
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      errors.push(buildError(parsed.error, idx + 2));
    }
  });
  return { name, total: objects.length, errors };
}

async function validateContract(repoRoot, contractId) {
  const dir = await resolveDatasetDir(repoRoot, contractId);
  const files = {
    users: "users.csv",
    sites: "sites.csv",
    projects: "projects.csv",
    locations: "locations.csv",
    teamMembers: "team_members.csv",
    updates: "updates.csv",
    updateAi: "update_ai_outputs.csv",
    updateAttachments: "update_attachments.csv",
    riskEffects: "update_risk_downstream_effects.csv",
    riskActions: "update_risk_recommended_actions.csv",
    tasks: "tasks.csv",
    taskAttachments: "task_attachments.csv",
    attendanceSessions: "attendance_sessions.csv",
    attendances: "attendances.csv",
  };

  const data = {};
  for (const [k, f] of Object.entries(files)) {
    data[k] = await readCsv(path.join(dir, f));
  }

  const pack = resolveDemoDatasetPack(path.basename(dir));
  const masterLocErrs = validateLocationMasterRows(data.locations, pack);
  const locIds = new Set(
    data.locations.map((r) => r.id?.trim()).filter(Boolean)
  );
  const linkLocErrs = validateTaskAndAiLocationLinks(
    data.tasks,
    data.updateAi,
    locIds
  );
  const updateLocErrs = validateUpdateLocationLinks(data.updates, locIds);
  const locationErrors = [...masterLocErrs, ...linkLocErrs, ...updateLocErrs];

  const attachmentsByTask = groupBy(data.taskAttachments, "taskId");
  const attachmentsByUpdate = groupBy(data.updateAttachments, "updateId");
  const aiByUpdate = new Map(data.updateAi.map((r) => [r.updateId, r]));
  const riskEffectsByUpdate = groupBy(data.riskEffects, "updateId");
  const riskActionsByUpdate = groupBy(data.riskActions, "updateId");
  const userObjects = data.users.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    orgRoleCode: legacyUserRoleStringToRoleTypeCode(r.role),
    departmentCode: departmentStringToCode(r.department) ?? undefined,
    specialty: optionalString(r.specialty),
    phone: r.phone,
    employeeId: r.employeeId,
    avatarUrl: optionalString(r.avatarUrl),
    preferences: {
      pushNotificationsEnabled: parseBoolean(
        r.preferences_pushNotificationsEnabled,
        "preferences_pushNotificationsEnabled"
      ),
      darkModeEnabled: parseBoolean(
        r.preferences_darkModeEnabled,
        "preferences_darkModeEnabled"
      ),
    },
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const siteObjects = data.sites.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    address: r.address,
    location:
      r.locationLatitude && r.locationLongitude
        ? {
            latitude: parseNumber(r.locationLatitude, "locationLatitude"),
            longitude: parseNumber(r.locationLongitude, "locationLongitude"),
          }
        : undefined,
    projectManagerId: r.projectManagerId,
    isActive: parseBoolean(r.isActive, "isActive"),
    metadata: JSON.parse(r.metadata || "{}"),
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const teamMemberObjects = data.teamMembers.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    name: r.name,
    orgRoleCode: legacyUserRoleStringToRoleTypeCode(r.role),
    departmentCode: departmentStringToCode(r.department) ?? undefined,
    specialty: optionalString(r.specialty),
    reportsToUserId: optionalString(r.reportsToUserId),
    email: optionalString(r.email),
    phone: optionalString(r.phone),
    isActive: parseBoolean(r.isActive, "isActive"),
    joinedAt: parseDate(r.joinedAt, "joinedAt"),
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const projectObjects = data.projects.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    code: r.code,
    name: r.name,
    description: optionalString(r.description),
    type: optionalString(r.type),
    status: optionalString(r.status),
    isActive: parseBoolean(r.isActive, "isActive"),
    metadata: JSON.parse(r.metadata || "{}"),
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const updateObjects = data.updates.map((r) => {
    const ai = aiByUpdate.get(r.id);
    let aiOutput;
    if (ai) {
      aiOutput = {
        extractedInfo: {
          category: ai.category,
          department: departmentStringToCode(ai.department) ?? undefined,
          location: optionalString(ai.location),
          locationId: optionalString(ai.locationId),
          vendor: optionalString(ai.vendor),
          severity: ai.severity,
        },
        suggestedAssignment: {
          ownerRole: ai.ownerRole,
          ownerId: optionalString(ai.ownerId),
          dueDate: parseDate(ai.dueDate, "dueDate"),
        },
        generatedTaskDescription: ai.generatedTaskDescription,
        riskAssessment: {
          impact: ai.riskImpact,
          downstreamEffects: (riskEffectsByUpdate.get(r.id) || [])
            .sort((a, b) => parseNumber(a.order, "order") - parseNumber(b.order, "order"))
            .map((x) => x.effect),
          scheduleRisk: ai.scheduleRisk,
          recommendedActions: (riskActionsByUpdate.get(r.id) || [])
            .sort((a, b) => parseNumber(a.order, "order") - parseNumber(b.order, "order"))
            .map((x) => x.action),
        },
        confidence: parseNumber(ai.confidence, "confidence"),
        reviewRequirement: normalizeReviewRequirement({
          requirement: {
            required:
              ai.reviewRequired !== undefined && ai.reviewRequired !== ""
                ? ai.reviewRequired === "1"
                : ["Pending", "Processed", "Saved"].includes(normalizeUpdateStatus(r.status)),
            reasons: parseStringArrayJson(ai.reviewReasonsJson, "reviewReasonsJson"),
            fields: parseStringArrayJson(ai.reviewFieldsJson, "reviewFieldsJson"),
            prompt: optionalString(ai.reviewPrompt),
          },
          confidence:
            ai.reviewReasonsJson || ai.reviewFieldsJson || ai.reviewPrompt || ai.reviewRequired
              ? 1
              : parseNumber(ai.confidence, "confidence"),
          taskProposalSuggested:
            !(ai.reviewReasonsJson || ai.reviewFieldsJson || ai.reviewPrompt || ai.reviewRequired) &&
            ["Pending", "Processed", "Saved"].includes(normalizeUpdateStatus(r.status)) &&
            Boolean(ai.generatedTaskDescription?.trim()),
        }),
      };
    }
    return {
      id: r.id,
      siteId: r.siteId,
      projectId: r.projectId,
      locationId: optionalString(r.locationId),
      recordedBy: r.recordedBy,
      linkedTaskId: optionalString(r.linkedTaskId),
      transcript: r.transcript,
      audioUrl: optionalString(r.audioUrl),
      audioDuration: optionalString(r.audioDuration)
        ? parseNumber(r.audioDuration, "audioDuration")
        : undefined,
      attachments: (attachmentsByUpdate.get(r.id) || []).map((a) => ({
        id: a.id,
        url: a.url,
        type: a.type,
        uploadedAt: parseDate(a.uploadedAt, "uploadedAt"),
        taskId: optionalString(a.taskId) ?? undefined,
      })),
      aiOutput,
      status: normalizeUpdateStatus(r.status),
      createdAt: parseDate(r.createdAt, "createdAt"),
      updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
    };
  });

  const taskObjects = data.tasks.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    projectId: r.projectId,
    title: r.title,
    description: r.description,
    ownerId: r.ownerId,
    assigneeRoleCode: legacyUserRoleStringToRoleTypeCode(r.assigneeRole),
    severity: r.severity,
    departmentCode: departmentStringToCode(r.department) ?? undefined,
    location: r.location,
    locationId: optionalString(r.locationId),
    status: r.status,
    source: r.source,
    sourceUpdateId: optionalString(r.sourceUpdateId),
    startDate: parseDate(r.startDate, "startDate"),
    dueDate: parseDate(r.dueDate, "dueDate"),
    completedAt: optionalString(r.completedAt)
      ? parseDate(r.completedAt, "completedAt")
      : undefined,
    attachments: (attachmentsByTask.get(r.id) || []).map((a) => ({
      id: a.id,
      url: a.url,
      type: a.type,
      uploadedAt: parseDate(a.uploadedAt, "uploadedAt"),
    })),
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const sessionObjects = data.attendanceSessions.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    projectId: r.projectId,
    sessionDate: r.sessionDate,
    conductedBy: r.conductedBy,
    createdAt: parseDate(r.createdAt, "createdAt"),
    updatedAt: parseDate(coalesceUpdatedAtIso(r), "updatedAt"),
  }));

  const attendanceObjects = data.attendances.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    teamMemberId: r.teamMemberId,
    status: r.status,
    notes: optionalString(r.notes),
    recordedAt: parseDate(r.recordedAt, "recordedAt"),
  }));

  const results = [
    {
      name: "locations",
      total: data.locations.length,
      errors: locationErrors.map((e, i) => `${i + 1}: ${e}`),
    },
    validateRows("users", UserSchema, userObjects),
    validateRows("sites", SiteSchema, siteObjects),
    validateRows("projects", ProjectSchema, projectObjects),
    validateRows("team_members", TeamMemberSchema, teamMemberObjects),
    validateRows("updates", UpdateSchema, updateObjects),
    validateRows("tasks", TaskSchema, taskObjects),
    validateRows("attendance_sessions", AttendanceSessionSchema, sessionObjects),
    validateRows("attendances", AttendanceSchema, attendanceObjects),
  ];
  return { contractId, results };
}

function printContractResult(result) {
  console.log(`\nContract ${result.contractId}`);
  let hasErrors = false;
  for (const r of result.results) {
    if (r.errors.length) {
      hasErrors = true;
      console.log(`- ${r.name}: FAIL (${r.errors.length} errors)`);
      for (const e of r.errors.slice(0, 3)) console.log(`  - ${e}`);
    } else {
      console.log(`- ${r.name}: PASS (${r.total} rows)`);
    }
  }
  return hasErrors;
}

async function main() {
  const args = parseArgs(process.argv);
  const all = [];
  for (const contractId of args.contracts) {
    all.push(await validateContract(args.repoRoot, contractId));
  }
  let anyErrors = false;
  for (const result of all) {
    anyErrors = printContractResult(result) || anyErrors;
  }
  if (anyErrors) {
    process.exitCode = 1;
    console.error("\nValidation failed.");
  } else {
    console.log("\nValidation passed for all contracts.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
