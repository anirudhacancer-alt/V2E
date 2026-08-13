#!/usr/bin/env node
/**
 * Refresh demo CSVs: short Indian first names, location master data (locations.csv),
 * Department-weighted locationId assignment, project display names (RES-1328 / COM-1330).
 * Run from repo root: node docs/demo/tools/refresh_demo_names_locations.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "../../..");

/** Common Indian first names (short); site lead first, then crew */
const NAMES_1328 = [
  "Rakesh",
  "Aarav",
  "Arjun",
  "Kabir",
  "Rohit",
  "Vikram",
  "Neeraj",
  "Suresh",
  "Aditya",
  "Siddharth",
  "Krish",
  "Dev",
  "Priya",
];

const NAMES_1330 = [
  "Ishaan",
  "Agastya",
  "Ayansh",
  "Vihaan",
  "Rudra",
  "Vedant",
  "Harsh",
  "Manish",
  "Tarun",
  "Kiran",
  "Ananya",
  "Amit",
  "Neha",
];

/** @typedef {{ id: string, displayLabel: string, level1: string, level2: string, level3: string, level4: string }} LocRow */

/** Canonical display string from levels (must match seed `deriveLocationDisplayLabel`). */
function deriveDisplayLabelFromLevels(loc) {
  return [loc.level1, loc.level2, loc.level3, loc.level4]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Keywords per department bias selection (matched case-insensitively in displayLabel). */
const TRADE_KEYWORDS_RES = {
  Structure: ["Core", "Podium", "Basement", "Facade", "Slab", "Pour"],
  RCC: ["Core", "Podium", "Basement", "Facade", "Slab"],
  Concrete: ["Core", "Podium", "Basement", "Pour"],
  Steel: ["Core", "Facade", "Roof", "Tower"],
  MEP: ["Pump Room", "Service Corridor", "Basement", "MEP"],
  Electrical: ["Pump Room", "Service Corridor", "Basement", "Electrical"],
  Plumbing: ["Pump Room", "Service Corridor", "Basement"],
  Finishing: ["Lift Lobby", "Unit", "Amenity", "Balcony", "Lobby"],
  Painting: ["Unit", "Amenity", "Facade", "Tower"],
  Procurement: ["Parking Bay", "Podium", "Loading"],
  Carpentry: ["Unit", "Amenity", "Stair"],
  Masonry: ["Facade", "Podium", "Core"],
};

const TRADE_KEYWORDS_COM = {
  Structure: ["Central Core", "Podium", "Basement"],
  Electrical: ["Electrical Room", "Server Room", "Central Core"],
  Finishing: ["Main Lobby", "Reception", "Meeting Suite", "Open Office"],
  MEP: ["Plant Room", "MEP Corridor", "Roof Plant"],
  Procurement: ["Loading Dock", "Service Yard", "Parking"],
  RCC: ["Central Core", "Podium"],
  Concrete: ["Central Core", "Basement"],
  Steel: ["Central Core", "Roof Plant"],
  Plumbing: ["MEP Corridor", "Basement"],
  Carpentry: ["Tenant Floor", "Open Office"],
  Masonry: ["Podium", "Service Yard"],
  Painting: ["Open Office", "Main Lobby"],
};

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
  if (rows.length === 0) return { header: [], body: [] };
  const [header, ...body] = rows;
  const filtered = body.filter((r) => !(r.length === 1 && r[0] === ""));
  return { header, body: filtered };
}

function serializeCsv(header, body) {
  const esc = (s) => {
    const t = String(s ?? "");
    if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  };
  const lines = [
    header.map(esc).join(","),
    ...body.map((r) => r.map(esc).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

/** @returns {LocRow[]} */
async function loadLocations(contractDir) {
  const p = path.join(contractDir, "locations.csv");
  const raw = await fs.readFile(p, "utf8");
  const { header, body } = parseCsv(raw);
  const ix = (name) => header.indexOf(name);
  return body.map((r) => {
    const row = {
      id: r[ix("id")] ?? "",
      level1: r[ix("level1")] ?? "",
      level2: r[ix("level2")] ?? "",
      level3: r[ix("level3")] ?? "",
      level4: r[ix("level4")] ?? "",
    };
    return {
      ...row,
      displayLabel: deriveDisplayLabelFromLevels(row),
    };
  });
}

/**
 * @param {LocRow[]} locations
 * @param {string} department
 * @param {"res"|"com"} kind
 * @param {number} rowIndex
 */
function pickLocationForTrade(locations, department, kind, rowIndex) {
  const map = kind === "res" ? TRADE_KEYWORDS_RES : TRADE_KEYWORDS_COM;
  const keywords = map[department] ?? [];
  const lower = (s) => s.toLowerCase();
  let pool = locations;
  if (keywords.length > 0) {
    const matched = locations.filter((loc) =>
      keywords.some((kw) => lower(loc.displayLabel).includes(lower(kw)))
    );
    if (matched.length > 0) pool = matched;
  }
  return pool[rowIndex % pool.length];
}

/**
 * Insert column after `afterName`; if exists, returns header/body unchanged (column already present).
 */
function ensureColumn(header, body, colName, afterName, fill = "") {
  if (header.includes(colName)) return { header, body };
  const afterIdx = header.indexOf(afterName);
  const insertAt = afterIdx >= 0 ? afterIdx + 1 : header.length;
  const nextHeader = [...header.slice(0, insertAt), colName, ...header.slice(insertAt)];
  const nextBody = body.map((row) => {
    const next = [...row.slice(0, insertAt), fill, ...row.slice(insertAt)];
    return next;
  });
  return { header: nextHeader, body: nextBody };
}

function shortenTranscript(text, displayLabel) {
  const tradeMatch = text.match(/Trade\s+(\w+)\s+reports\s+(.+)/i);
  if (tradeMatch) {
    const rest = tradeMatch[2].trim();
    const shortRest = rest.length > 85 ? `${rest.slice(0, 82)}…` : rest;
    return `${displayLabel}: Trade ${tradeMatch[1]} reports ${shortRest}`;
  }
  const tail = text.includes(":") ? text.split(":").pop().trim() : text;
  const clipped = tail.length > 100 ? `${tail.slice(0, 97)}…` : tail;
  return `${displayLabel}: ${clipped}`;
}

function shortenRiskImpact(shortLoc) {
  return `Potential delay at ${shortLoc} if unresolved.`;
}

function resolveTaskForUpdate(tasks, updates, updateIndex) {
  const u = updates[updateIndex];
  if (!u) return undefined;
  const bySpawn = tasks.find((t) => t.sourceUpdateId === u.id);
  if (bySpawn) return bySpawn;
  if (u.linkedTaskId) {
    const linked = tasks.find((t) => t.id === u.linkedTaskId);
    if (linked) return linked;
  }
  return tasks[updateIndex];
}

async function patchUsersTeamMembers(contractDir, names) {
  const usersPath = path.join(contractDir, "users.csv");
  const tmPath = path.join(contractDir, "team_members.csv");
  for (const [file, colName] of [
    [usersPath, "name"],
    [tmPath, "name"],
  ]) {
    const raw = await fs.readFile(file, "utf8");
    const { header, body } = parseCsv(raw);
    const idx = header.indexOf("name");
    if (idx < 0) throw new Error(`no name col in ${file}`);
    let ni = 0;
    for (const row of body) {
      row[idx] = names[ni % names.length];
      ni += 1;
    }
    await fs.writeFile(file, serializeCsv(header, body));
  }
}

async function patchProjects(contractDir, code, displayName, blurb) {
  const p = path.join(contractDir, "projects.csv");
  const raw = await fs.readFile(p, "utf8");
  const { header, body } = parseCsv(raw);
  const iCode = header.indexOf("code");
  const iName = header.indexOf("name");
  const iDesc = header.indexOf("description");
  if (body.length !== 1) throw new Error("expected one project row");
  body[0][iCode] = code;
  body[0][iName] = displayName;
  if (iDesc >= 0) body[0][iDesc] = blurb;
  await fs.writeFile(p, serializeCsv(header, body));
}

/** @param {"res"|"com"} kind */
async function patchTasks(contractDir, locations, kind) {
  const p = path.join(contractDir, "tasks.csv");
  const raw = await fs.readFile(p, "utf8");
  let { header, body } = parseCsv(raw);
  ({ header, body } = ensureColumn(header, body, "locationId", "location", ""));
  const iLoc = header.indexOf("location");
  const iLid = header.indexOf("locationId");
  const iDept = header.indexOf("department");
  if (iLoc < 0) throw new Error("tasks: no location");
  if (iDept < 0) throw new Error("tasks: no department");

  body.forEach((row, r) => {
    const dept = row[iDept] || "Structure";
    const picked = pickLocationForTrade(locations, dept, kind, r);
    row[iLid] = picked.id;
    row[iLoc] = picked.displayLabel;
  });
  await fs.writeFile(p, serializeCsv(header, body));
}

/** Set `updates.locationId` from the paired task (same resolution as materialize seed). */
async function patchUpdatesLocationIds(contractDir) {
  const tasksPath = path.join(contractDir, "tasks.csv");
  const updatesPath = path.join(contractDir, "updates.csv");
  const tRaw = await fs.readFile(tasksPath, "utf8");
  const uRaw = await fs.readFile(updatesPath, "utf8");
  let { header, body } = parseCsv(uRaw);
  ({ header, body } = ensureColumn(header, body, "locationId", "projectId", ""));
  const pt = parseCsv(tRaw);
  const th = pt.header;
  const tasks = pt.body.map((r) =>
    Object.fromEntries(th.map((h, i) => [h, r[i] ?? ""]))
  );
  const uh = header;
  const updates = body.map((r) =>
    Object.fromEntries(uh.map((h, i) => [h, r[i] ?? ""]))
  );
  const iLid = header.indexOf("locationId");
  updates.forEach((u, idx) => {
    const task = resolveTaskForUpdate(tasks, updates, idx);
    const lid = task?.locationId ?? "";
    if (body[idx] && iLid >= 0) body[idx][iLid] = lid;
  });
  await fs.writeFile(updatesPath, serializeCsv(header, body));
}

/** @param {"res"|"com"} kind */
async function patchUpdateAiOutputs(contractDir, locations, kind) {
  const p = path.join(contractDir, "update_ai_outputs.csv");
  const raw = await fs.readFile(p, "utf8");
  let { header, body } = parseCsv(raw);
  ({ header, body } = ensureColumn(header, body, "locationId", "location", ""));
  const ix = (k) => header.indexOf(k);
  const iLoc = ix("location");
  const iLid = ix("locationId");
  const iRisk = ix("riskImpact");
  const iBlock = ix("blockerSubtype");
  const iCat = ix("category");
  const iLB = ix("locationBlock");
  const iLZ = ix("locationZone");
  const iLL = ix("locationLevel");
  const iLA = ix("locationArea");
  const iDept = ix("department");
  const blockerSubs = [
    "Material delay",
    "Site access",
    "Drawing hold",
    "QC failure",
    "Dependency",
  ];

  body.forEach((row, r) => {
    const dept = row[iDept] || "Structure";
    const picked = pickLocationForTrade(locations, dept, kind, r);
    row[iLid] = picked.id;
    if (iLoc >= 0) row[iLoc] = picked.displayLabel;
    if (iLB >= 0) row[iLB] = picked.level1;
    if (iLZ >= 0) row[iLZ] = picked.level2;
    if (iLL >= 0) row[iLL] = picked.level3;
    if (iLA >= 0) row[iLA] = picked.level4;
    if (iBlock >= 0 && iCat >= 0 && row[iCat] === "Blocker") {
      row[iBlock] = blockerSubs[r % blockerSubs.length];
    }
    if (iRisk >= 0) row[iRisk] = shortenRiskImpact(picked.displayLabel);
  });
  await fs.writeFile(p, serializeCsv(header, body));
}

/** Align AI rows to the same location as the paired task (by update → task resolution). */
async function alignAiToTasks(contractDir) {
  const tasksPath = path.join(contractDir, "tasks.csv");
  const aiPath = path.join(contractDir, "update_ai_outputs.csv");
  const updatesPath = path.join(contractDir, "updates.csv");

  const tRaw = await fs.readFile(tasksPath, "utf8");
  const aRaw = await fs.readFile(aiPath, "utf8");
  const uRaw = await fs.readFile(updatesPath, "utf8");

  const pt = parseCsv(tRaw);
  const pa = parseCsv(aRaw);
  const pu = parseCsv(uRaw);

  const th = pt.header;
  const tasks = pt.body.map((r) =>
    Object.fromEntries(th.map((h, i) => [h, r[i] ?? ""]))
  );
  const uh = pu.header;
  const updates = pu.body.map((r) =>
    Object.fromEntries(uh.map((h, i) => [h, r[i] ?? ""]))
  );

  const locCsv = await fs.readFile(path.join(contractDir, "locations.csv"), "utf8");
  const pl = parseCsv(locCsv);
  const lh = pl.header;
  const locRows = pl.body.map((r) => {
    const o = Object.fromEntries(lh.map((h, i) => [h, r[i] ?? ""]));
    return { ...o, displayLabel: deriveDisplayLabelFromLevels(o) };
  });
  const locById = new Map(locRows.map((l) => [l.id, l]));

  const aiHeader = pa.header;
  const aiBody = pa.body;
  const iUpdateId = aiHeader.indexOf("updateId");
  const iLoc = aiHeader.indexOf("location");
  const iLid = aiHeader.indexOf("locationId");
  const iLB = aiHeader.indexOf("locationBlock");
  const iLZ = aiHeader.indexOf("locationZone");
  const iLL = aiHeader.indexOf("locationLevel");
  const iLA = aiHeader.indexOf("locationArea");
  const iRisk = aiHeader.indexOf("riskImpact");

  const updateIndexById = new Map(updates.map((u, i) => [u.id, i]));

  for (const row of aiBody) {
    const uid = row[iUpdateId];
    const ui = updateIndexById.get(uid);
    if (ui === undefined) continue;
    const task = resolveTaskForUpdate(tasks, updates, ui);
    if (!task) continue;
    const lid = task.locationId ?? "";
    if (iLid >= 0) row[iLid] = lid;
    const master = locById.get(lid);
    if (!master) continue;
    const derived = deriveDisplayLabelFromLevels(master);
    if (iLoc >= 0) row[iLoc] = derived;
    if (iLB >= 0) row[iLB] = master.level1;
    if (iLZ >= 0) row[iLZ] = master.level2;
    if (iLL >= 0) row[iLL] = master.level3;
    if (iLA >= 0) row[iLA] = master.level4;
    if (iRisk >= 0) row[iRisk] = shortenRiskImpact(derived);
  }

  await fs.writeFile(aiPath, serializeCsv(aiHeader, aiBody));
}

async function patchUpdatesTranscripts(contractDir) {
  const tasksPath = path.join(contractDir, "tasks.csv");
  const updatesPath = path.join(contractDir, "updates.csv");
  const tRaw = await fs.readFile(tasksPath, "utf8");
  const uRaw = await fs.readFile(updatesPath, "utf8");
  const pt = parseCsv(tRaw);
  const pu = parseCsv(uRaw);
  const th = pt.header;
  const tasks = pt.body.map((r) =>
    Object.fromEntries(th.map((h, i) => [h, r[i] ?? ""]))
  );
  const uh = pu.header;
  const updates = pu.body.map((r) =>
    Object.fromEntries(uh.map((h, i) => [h, r[i] ?? ""]))
  );
  const iTrans = uh.indexOf("transcript");
  if (iTrans < 0) throw new Error("updates: no transcript");

  updates.forEach((u, idx) => {
    const task = resolveTaskForUpdate(tasks, updates, idx);
    const display = task?.location ?? "";
    const row = pu.body[idx];
    if (!row) return;
    row[iTrans] = shortenTranscript(row[iTrans], display);
  });
  await fs.writeFile(updatesPath, serializeCsv(pu.header, pu.body));
}

async function main() {
  const c1328 = path.join(REPO, "docs", "demo", "datasets", "RES-1328");
  const c1330 = path.join(REPO, "docs", "demo", "datasets", "COM-1330");

  await patchProjects(
    c1328,
    "RES-1328",
    "RES-1328",
    "Residential build — demo contract 1328 (Gurugram site)."
  );
  await patchProjects(
    c1330,
    "COM-1330",
    "COM-1330",
    "Commercial tower — demo contract 1330 (Gurugram site)."
  );

  await patchUsersTeamMembers(c1328, NAMES_1328);
  await patchUsersTeamMembers(c1330, NAMES_1330);

  const loc1328 = await loadLocations(c1328);
  const loc1330 = await loadLocations(c1330);

  await patchTasks(c1328, loc1328, "res");
  await patchTasks(c1330, loc1330, "com");

  await patchUpdatesLocationIds(c1328);
  await patchUpdatesLocationIds(c1330);

  await patchUpdateAiOutputs(c1328, loc1328, "res");
  await patchUpdateAiOutputs(c1330, loc1330, "com");

  await alignAiToTasks(c1328);
  await alignAiToTasks(c1330);

  await patchUpdatesTranscripts(c1328);
  await patchUpdatesTranscripts(c1330);

  console.log("Updated RES-1328 and COM-1330: names, locations, locationId, transcripts.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
