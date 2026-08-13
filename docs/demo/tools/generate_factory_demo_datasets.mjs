#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_ROWS = 80;

const SHARED_FACTORY_SITE = {
  siteId: stableUuid("factory-site"),
  managerUserId: stableUuid("factory-manager-user"),
  managerTeamMemberId: stableUuid("factory-manager-team-member"),
  leadUserId: "80f1de64-5ef6-47c2-9ee8-d890b7536342",
  leadTeamMemberId: "4ab80f20-6850-44e2-ae7a-0e0ca9d3d6c8",
  name: "Helios Chocolate Campus",
  code: "SITE-HELIOS-01",
  address: "Westpoort Industrial Zone, Amsterdam",
  latitude: "52.4108",
  longitude: "4.8427",
  managerName: "Milan Verhoeven",
  managerEmail: "plant.manager@demo.local",
  managerPhone: "+31610000001",
  managerEmployeeId: "EMP-HELIOS-PLANT-001",
  leadName: "Aarush Mehta",
  leadEmail: "shift.supervisor.factory@demo.local",
  leadPhone: "+31610000002",
  leadEmployeeId: "EMP-HELIOS-SHIFT-001",
};

const PROCESS_LOCATIONS = [
  ["Plant 1", "Raw Material Store", "Cocoa Intake", "Silo Bay"],
  ["Plant 1", "Mixing Hall", "Batching Zone", "Mixer 02"],
  ["Plant 1", "Refining Room", "Conching Cell", "Conche 03"],
  ["Plant 1", "Tempering Bay", "Line 1", "Tempering Unit"],
  ["Plant 1", "Moulding Line", "Line 1", "Mould Set A"],
  ["Plant 1", "Cooling Tunnel", "Line 1", "Tunnel Entry"],
  ["Plant 1", "QA Lab", "Release Bench", "Sample Station"],
  ["Plant 1", "Utilities Block", "Steam Plant", "Boiler 1"],
  ["Plant 1", "CIP Station", "Wash Skid", "Loop A"],
  ["Plant 1", "Mixing Hall", "Liquor Tank Farm", "Tank 04"],
  ["Plant 1", "Refining Room", "Pre-Refiner", "Mill 02"],
  ["Plant 1", "Cooling Tunnel", "Line 2", "Tunnel Exit"],
];

const PACKAGING_LOCATIONS = [
  ["Plant 1", "Packaging Hall", "Bagging Line", "Line A"],
  ["Plant 1", "Packaging Hall", "Carton Station", "Case Former 02"],
  ["Plant 1", "Packaging Hall", "Metal Detector", "Lane 1"],
  ["Plant 1", "Packaging Hall", "Coding Station", "Printer 03"],
  ["Plant 1", "Packaging Hall", "Palletising Zone", "Robot Cell 1"],
  ["Plant 1", "Finished Goods Warehouse", "Cold Lane", "Rack 12"],
  ["Plant 1", "Dispatch Bay", "Outbound Staging", "Door 04"],
  ["Plant 1", "Packaging Hall", "Film Store", "Roll Cage 6"],
  ["Plant 1", "Packaging Hall", "Label Room", "Verifier Bench"],
  ["Plant 1", "Finished Goods Warehouse", "QA Hold Area", "Pallet Lane 2"],
  ["Plant 1", "Dispatch Bay", "Preload Check", "Door 02"],
  ["Plant 1", "Packaging Hall", "Bagging Line", "Line B"],
];

const PROCESS_SCENARIOS = [
  {
    department: "Production",
    role: "ShiftSupervisor",
    category: "GeneralUpdate",
    severity: "Medium",
    vendor: "Process Team",
    blockerSubtype: "Batch deviation",
    titleStem: "Batch deviation",
    summary: "Batch viscosity drift needs correction before moulding can resume on the current run.",
    riskImpact: "Semi-finished output will slip if the batch cannot be stabilised this shift.",
  },
  {
    department: "Quality",
    role: "QualityLead",
    category: "QAIssue",
    severity: "High",
    vendor: "QA Lab",
    blockerSubtype: "QA hold",
    titleStem: "QA release hold",
    summary: "QA release is pending after particle size results moved outside the expected range.",
    riskImpact: "The batch cannot move to tempering until QA release is restored.",
  },
  {
    department: "Maintenance",
    role: "MaintenanceEngineer",
    category: "Blocker",
    severity: "High",
    vendor: "Maintenance Team",
    blockerSubtype: "Line stoppage",
    titleStem: "Conche restart",
    summary: "The conche line stopped on overload and needs maintenance restart checks before the next batch.",
    riskImpact: "Conching backlog will delay upstream batch flow and downstream moulding.",
  },
  {
    department: "Utilities",
    role: "Technician",
    category: "Blocker",
    severity: "Critical",
    vendor: "Utilities Team",
    blockerSubtype: "Utility interruption",
    titleStem: "Steam pressure drop",
    summary: "Steam pressure dipped below setpoint and tempering stability is at risk until utilities recover.",
    riskImpact: "Tempering and CIP timing will be disrupted if utilities do not stabilise quickly.",
  },
  {
    department: "Production",
    role: "LineSupervisor",
    category: "Blocker",
    severity: "High",
    vendor: "Process Team",
    blockerSubtype: "Moulding jam",
    titleStem: "Moulding jam",
    summary: "Chocolate mass is building at the depositor and moulding line clearance is required.",
    riskImpact: "Callets and drops output will slip until the moulding line restarts.",
  },
  {
    department: "Production",
    role: "Operator",
    category: "Blocker",
    severity: "Medium",
    vendor: "Process Team",
    blockerSubtype: "Cooling tunnel backlog",
    titleStem: "Cooling tunnel backlog",
    summary: "Cooling tunnel dwell time has stretched and semi-finished product is backing up before discharge.",
    riskImpact: "Line throughput will remain constrained until cooling tunnel balance is restored.",
  },
  {
    department: "Utilities",
    role: "Technician",
    category: "GeneralUpdate",
    severity: "Medium",
    vendor: "CIP Team",
    blockerSubtype: "CIP incomplete",
    titleStem: "CIP verification",
    summary: "CIP completion needs verification before the next cocoa powder batch can start safely.",
    riskImpact: "The line cannot release the next batch until CIP verification is signed off.",
  },
  {
    department: "Procurement",
    role: "Storekeeper",
    category: "MaterialDelay",
    severity: "Medium",
    vendor: "Warehouse Team",
    blockerSubtype: "Raw material shortage",
    titleStem: "Cocoa powder stock",
    summary: "Cocoa powder stock is lower than plan and intake needs replenishment before tonight's run.",
    riskImpact: "Upstream batch planning will slip if intake stock is not recovered today.",
  },
];

const PACKAGING_SCENARIOS = [
  {
    department: "Packaging",
    role: "ShiftSupervisor",
    category: "Blocker",
    severity: "High",
    vendor: "Packaging Team",
    blockerSubtype: "Wrong film",
    titleStem: "Film mismatch",
    summary: "The active film roll does not match the chip SKU and bagging line changeover is blocked.",
    riskImpact: "Packed chips cannot be released until the correct film is loaded and verified.",
  },
  {
    department: "Quality",
    role: "QualityLead",
    category: "QAIssue",
    severity: "High",
    vendor: "QA Lab",
    blockerSubtype: "Label mismatch",
    titleStem: "Label verification",
    summary: "Label artwork does not match the callets batch code and QA release is on hold.",
    riskImpact: "Dispatch cannot proceed for the affected pallet set until label verification is closed.",
  },
  {
    department: "Packaging",
    role: "LineSupervisor",
    category: "Blocker",
    severity: "High",
    vendor: "Packaging Team",
    blockerSubtype: "Seal failure",
    titleStem: "Seal integrity",
    summary: "Seal integrity alarms are repeating on the drops line and bagging is unstable.",
    riskImpact: "Packed drops will be quarantined unless seal integrity returns to standard.",
  },
  {
    department: "Packaging",
    role: "Technician",
    category: "Blocker",
    severity: "Critical",
    vendor: "Packaging Team",
    blockerSubtype: "Metal detector reject",
    titleStem: "Metal detector reject",
    summary: "Repeated rejects on the chunks line need investigation before product can move to palletising.",
    riskImpact: "Warehouse intake and dispatch slots will slip if rejects continue.",
  },
  {
    department: "Warehouse",
    role: "Storekeeper",
    category: "MaterialDelay",
    severity: "Medium",
    vendor: "Warehouse Team",
    blockerSubtype: "Carton shortage",
    titleStem: "Carton shortage",
    summary: "Carton stock is short for the current callets order and pallet build cannot continue at plan rate.",
    riskImpact: "Packing completion and warehouse staging will slip without fresh carton stock.",
  },
  {
    department: "Packaging",
    role: "ShiftSupervisor",
    category: "GeneralUpdate",
    severity: "Medium",
    vendor: "Dispatch Team",
    blockerSubtype: "Dispatch delay",
    titleStem: "Dispatch staging",
    summary: "Outbound staging is congested and finished goods are queueing before dispatch bay release.",
    riskImpact: "Dispatch timing for the packed chips and chunks orders is at risk this shift.",
  },
  {
    department: "Planning",
    role: "ShiftSupervisor",
    category: "GeneralUpdate",
    severity: "Medium",
    vendor: "Planning Team",
    blockerSubtype: "QA release wait",
    titleStem: "Release sequencing",
    summary: "QA release sequencing needs rework so palletising does not outrun warehouse clearance.",
    riskImpact: "Packaging flow will slow if release timing is not reset by planning.",
  },
  {
    department: "Packaging",
    role: "Operator",
    category: "WorkCompletion",
    severity: "Low",
    vendor: "Packaging Team",
    blockerSubtype: "Code check",
    titleStem: "Code check",
    summary: "Coding checks are complete on the callets lane and the next pallet set is ready for release.",
    riskImpact: "No immediate risk if dispatch keeps pace with palletising.",
  },
];

function stableUuid(...parts) {
  const hex = createHash("sha1").update(parts.join("::")).digest("hex").slice(0, 32);
  const bytes = hex.split("");
  bytes[12] = "4";
  bytes[16] = "8";
  return `${bytes.slice(0, 8).join("")}-${bytes.slice(8, 12).join("")}-${bytes.slice(12, 16).join("")}-${bytes.slice(16, 20).join("")}-${bytes.slice(20, 32).join("")}`;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function writeCsv(filePath, fieldnames, rows) {
  const content = [
    fieldnames.join(","),
    ...rows.map((row) => fieldnames.map((field) => csvEscape(row[field] ?? "")).join(",")),
  ].join("\n");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${content}\n`, "utf8");
}

function isoAt(baseDayOffset, minuteOffset) {
  const base = new Date(Date.UTC(2026, 2, 1, 8, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + baseDayOffset);
  base.setUTCMinutes(base.getUTCMinutes() + minuteOffset);
  return base.toISOString();
}

function deriveLocationDisplay(levels) {
  return levels.filter(Boolean).join(" · ");
}

function buildLocations(projectCode, prefix, siteType, definitions) {
  return definitions.map((levels, index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    projectCode,
    siteType,
    level1: levels[0],
    level2: levels[1],
    level3: levels[2],
    level4: levels[3],
    displayLabel: deriveLocationDisplay(levels),
    isActive: "1",
    sortOrder: String(index + 1),
  }));
}

function buildSharedPeople(projectCode, variant) {
  const shared = [
    {
      id: SHARED_FACTORY_SITE.managerUserId,
      name: SHARED_FACTORY_SITE.managerName,
      email: SHARED_FACTORY_SITE.managerEmail,
      role: "PlantManager",
      department: "",
      specialty: "General",
      phone: SHARED_FACTORY_SITE.managerPhone,
      employeeId: SHARED_FACTORY_SITE.managerEmployeeId,
    },
    {
      id: SHARED_FACTORY_SITE.leadUserId,
      name: SHARED_FACTORY_SITE.leadName,
      email: SHARED_FACTORY_SITE.leadEmail,
      role: "ShiftSupervisor",
      department: variant === "Packaging" ? "Packaging" : "Production",
      specialty: variant === "Packaging" ? "Packaging" : "Production",
      phone: SHARED_FACTORY_SITE.leadPhone,
      employeeId: SHARED_FACTORY_SITE.leadEmployeeId,
    },
  ];

  const people = [
    ...shared,
    {
      id: stableUuid(projectCode, "line-supervisor"),
      name: variant === "Packaging" ? "Lotte Bos" : "Sanjay Rao",
      email: `line.supervisor.${projectCode.toLowerCase()}@demo.local`,
      role: "LineSupervisor",
      department: variant === "Packaging" ? "Packaging" : "Production",
      specialty: variant === "Packaging" ? "Packaging" : "Production",
      phone: variant === "Packaging" ? "+31610000011" : "+31610000010",
      employeeId: `EMP-${projectCode}-LINE-001`,
    },
    {
      id: stableUuid(projectCode, "quality-lead"),
      name: "Eva Kramer",
      email: `quality.lead.${projectCode.toLowerCase()}@demo.local`,
      role: "QualityLead",
      department: "Quality",
      specialty: "Quality",
      phone: "+31610000012",
      employeeId: `EMP-${projectCode}-QA-001`,
    },
    {
      id: stableUuid(projectCode, "maintenance-engineer"),
      name: "Mateo Singh",
      email: `maintenance.${projectCode.toLowerCase()}@demo.local`,
      role: "MaintenanceEngineer",
      department: "Maintenance",
      specialty: "Maintenance",
      phone: "+31610000013",
      employeeId: `EMP-${projectCode}-MNT-001`,
    },
    {
      id: stableUuid(projectCode, "operator"),
      name: variant === "Packaging" ? "Noor Hassan" : "Kiaan Dutta",
      email: `operator.${projectCode.toLowerCase()}@demo.local`,
      role: "Operator",
      department: variant === "Packaging" ? "Packaging" : "Production",
      specialty: variant === "Packaging" ? "Packaging" : "Production",
      phone: variant === "Packaging" ? "+31610000015" : "+31610000014",
      employeeId: `EMP-${projectCode}-OPS-001`,
    },
    {
      id: stableUuid(projectCode, "technician"),
      name: "Ruben Das",
      email: `technician.${projectCode.toLowerCase()}@demo.local`,
      role: "Technician",
      department: variant === "Packaging" ? "Packaging" : "Utilities",
      specialty: variant === "Packaging" ? "Packaging" : "Utilities",
      phone: "+31610000016",
      employeeId: `EMP-${projectCode}-TECH-001`,
    },
    {
      id: stableUuid(projectCode, "storekeeper"),
      name: "Inez Verma",
      email: `storekeeper.${projectCode.toLowerCase()}@demo.local`,
      role: "Storekeeper",
      department: variant === "Packaging" ? "Warehouse" : "Procurement",
      specialty: variant === "Packaging" ? "Warehouse" : "Procurement",
      phone: "+31610000017",
      employeeId: `EMP-${projectCode}-STK-001`,
    },
  ];

  return people;
}

function buildUsers(people) {
  return people.map((person, index) => ({
    id: person.id,
    email: person.email,
    name: person.name,
    role: person.role,
    department: person.department,
    specialty: person.specialty,
    phone: person.phone,
    employeeId: person.employeeId,
    avatarUrl: "",
    preferences_pushNotificationsEnabled: index % 3 === 0 ? "false" : "true",
    preferences_darkModeEnabled: index % 4 === 0 ? "true" : "false",
    createdAt: isoAt(-40 + index, index * 9),
    updatedAt: isoAt(-40 + index, index * 9 + 30),
  }));
}

function buildTeamMembers(people) {
  return people.map((person, index) => ({
    id:
      person.id === SHARED_FACTORY_SITE.managerUserId
        ? SHARED_FACTORY_SITE.managerTeamMemberId
        : person.id === SHARED_FACTORY_SITE.leadUserId
          ? SHARED_FACTORY_SITE.leadTeamMemberId
          : stableUuid(person.id, "team-member"),
    siteId: SHARED_FACTORY_SITE.siteId,
    name: person.name,
    role: person.role,
    department: person.department,
    specialty: person.specialty,
    reportsToUserId: person.role === "PlantManager" ? "" : SHARED_FACTORY_SITE.managerUserId,
    email: person.email,
    phone: person.phone,
    isActive: "true",
    joinedAt: isoAt(-35 + index, index * 10),
    createdAt: isoAt(-35 + index, index * 10 + 5),
    updatedAt: isoAt(-35 + index, index * 10 + 20),
  }));
}

function buildProject(projectCode, contractId, variant) {
  return {
    id: stableUuid(projectCode, "project"),
    siteId: SHARED_FACTORY_SITE.siteId,
    code: projectCode,
    name: projectCode,
    description:
      variant === "Packaging"
        ? "Chocolate packaging and dispatch demo bundle."
        : "Chocolate process operations demo bundle.",
    isActive: "true",
    metadata: JSON.stringify({
      contractId,
      source: "synthetic-factory-pack",
      domain: "FactoryFMCGChocolate",
      bundleVariant: variant,
    }),
    createdAt: isoAt(-50, 0),
    updatedAt: isoAt(-4, 0),
  };
}

function buildSite(contractId) {
  return {
    id: SHARED_FACTORY_SITE.siteId,
    name: SHARED_FACTORY_SITE.name,
    code: SHARED_FACTORY_SITE.code,
    address: SHARED_FACTORY_SITE.address,
    locationLatitude: SHARED_FACTORY_SITE.latitude,
    locationLongitude: SHARED_FACTORY_SITE.longitude,
    projectManagerId: SHARED_FACTORY_SITE.managerUserId,
    isActive: "true",
    metadata: JSON.stringify({
      projectId: contractId,
      source: "synthetic-factory-pack",
      multiProjectSite: true,
      siteCluster: SHARED_FACTORY_SITE.code,
      domain: "FactoryFMCGChocolate",
    }),
    createdAt: isoAt(-60, 0),
    updatedAt: isoAt(-3, 0),
  };
}

function scenarioByIndex(scenarios, index) {
  return scenarios[index % scenarios.length];
}

function buildBundle({ contractId, projectCode, variant, locationPrefix, locations, scenarios, rows }) {
  const project = buildProject(projectCode, contractId, variant);
  const people = buildSharedPeople(projectCode, variant);
  const users = buildUsers(people);
  const teamMembers = buildTeamMembers(people);
  const teamMemberIds = new Map(teamMembers.map((row) => [row.name, row.id]));

  const updates = [];
  const updateAi = [];
  const updateAttachments = [];
  const riskEffects = [];
  const riskActions = [];
  const tasks = [];
  const taskAttachments = [];
  const attendanceSessions = [];
  const attendances = [];

  const statuses = ["Pending", "Processed", "CreatedNewTask", "Saved", "Escalated"];
  const taskStatuses = ["Active", "Blocked", "Done"];
  const severities = ["Critical", "High", "Medium", "Low"];

  for (let index = 0; index < rows; index += 1) {
    const scenario = scenarioByIndex(scenarios, index);
    const location = locations[index % locations.length];
    const updateId = stableUuid(projectCode, "update", String(index + 1));
    const taskId = stableUuid(projectCode, "task", String(index + 1));
    const status = statuses[index % statuses.length];
    const taskStatus = taskStatuses[index % taskStatuses.length];
    const severity = scenario.severity || severities[index % severities.length];
    const owner = people.find((person) => person.role === scenario.role) ?? people[1];
    const recordedBy = people[(index + 2) % people.length];
    const taskOwner = people[(index + 3) % people.length];

    updates.push({
      id: updateId,
      siteId: SHARED_FACTORY_SITE.siteId,
      projectId: project.id,
      locationId: location.id,
      recordedBy: recordedBy.id,
      linkedTaskId: "",
      transcript: `${location.displayLabel}: ${scenario.summary}`,
      audioUrl: `https://demo.local/audio/${contractId}/${updateId}.m4a`,
      audioDuration: String(32 + (index % 40)),
      status,
      createdAt: isoAt(-30 + Math.floor(index / 4), index * 11),
      updatedAt: isoAt(-30 + Math.floor(index / 4), index * 11 + 20),
      isRead: index % 4 === 0 ? "0" : "1",
      readAt: index % 4 === 0 ? "" : isoAt(-30 + Math.floor(index / 4), index * 11 + 35),
    });

    updateAi.push({
      updateId,
      category: scenario.category,
      department: scenario.department,
      location: location.displayLabel,
      locationId: location.id,
      vendor: scenario.vendor,
      severity,
      ownerRole: owner.role,
      ownerId: owner.id,
      dueDate: isoAt(4 + (index % 7), index * 7),
      generatedTaskDescription: scenario.summary,
      riskImpact: scenario.riskImpact,
      scheduleRisk: index % 5 === 0 ? "High" : index % 3 === 0 ? "Medium" : "Low",
      confidence: (0.64 + (index % 16) * 0.015).toFixed(2),
      blockerSubtype: scenario.blockerSubtype,
      locationBlock: location.level1,
      locationZone: location.level2,
      locationLevel: location.level3,
      locationArea: location.level4,
      reviewRequired: "",
      reviewPrompt: "",
      reviewReasonsJson: "",
      reviewFieldsJson: "",
      reviewedAt: "",
      reviewedBy: "",
    });

    updateAttachments.push({
      id: stableUuid(projectCode, "update-attachment-audio", String(index + 1)),
      updateId,
      taskId: "",
      url: `https://demo.local/audio/${contractId}/${updateId}.m4a`,
      type: "Audio",
      uploadedAt: isoAt(-30 + Math.floor(index / 4), index * 11 + 1),
    });
    updateAttachments.push({
      id: stableUuid(projectCode, "update-attachment-image", String(index + 1)),
      updateId,
      taskId: "",
      url: `https://demo.local/images/${contractId}/${updateId}.jpg`,
      type: "Image",
      uploadedAt: isoAt(-30 + Math.floor(index / 4), index * 11 + 2),
    });

    riskEffects.push({
      updateId,
      order: "1",
      effect:
        variant === "Packaging"
          ? "Packed output will queue in warehouse if the issue remains open."
          : "Semi-finished chocolate flow will slip if the issue remains open.",
    });
    riskEffects.push({
      updateId,
      order: "2",
      effect:
        variant === "Packaging"
          ? "Dispatch timing will drift if release is delayed across the shift."
          : "Downstream moulding and cooling tunnel output will drift across the shift.",
    });
    riskActions.push({
      updateId,
      order: "1",
      action: `Confirm owner and contain the issue on ${location.level2.toLowerCase()}.`,
    });
    riskActions.push({
      updateId,
      order: "2",
      action:
        variant === "Packaging"
          ? "Protect warehouse and dispatch sequence until the line is stable."
          : "Protect batch sequence until QA release and line stability are restored.",
    });

    tasks.push({
      id: taskId,
      siteId: SHARED_FACTORY_SITE.siteId,
      projectId: project.id,
      title: `${scenario.titleStem} ${index + 1}`,
      description: scenario.summary,
      ownerId: taskOwner.id,
      assigneeRole: owner.role,
      severity,
      department: scenario.department,
      location: location.displayLabel,
      locationId: location.id,
      status: taskStatus,
      source: index % 4 === 0 ? "Manual" : "AIGenerated",
      sourceUpdateId: "",
      startDate: isoAt(-5 + (index % 5), index * 8),
      dueDate: isoAt(3 + (index % 8), index * 9),
      completedAt: taskStatus === "Done" ? isoAt(index % 2, index * 10) : "",
      createdAt: isoAt(-28 + Math.floor(index / 5), index * 9),
      updatedAt: isoAt(-28 + Math.floor(index / 5), index * 9 + 25),
    });

    taskAttachments.push({
      id: stableUuid(projectCode, "task-attachment", String(index + 1), "1"),
      taskId,
      url: `https://demo.local/files/${contractId}/${taskId}/1.jpg`,
      type: "Image",
      uploadedAt: isoAt(-28 + Math.floor(index / 5), index * 9 + 3),
    });
  }

  for (let index = 0; index < 24; index += 1) {
    const sessionId = stableUuid(projectCode, "attendance-session", String(index + 1));
    attendanceSessions.push({
      id: sessionId,
      siteId: SHARED_FACTORY_SITE.siteId,
      projectId: project.id,
      sessionDate: isoAt(-24 + index, 0).slice(0, 10),
      conductedBy: SHARED_FACTORY_SITE.managerUserId,
      createdAt: isoAt(-24 + index, 30),
      updatedAt: isoAt(-24 + index, 45),
    });

    for (const person of people.slice(0, 6)) {
      const teamMemberId =
        person.id === SHARED_FACTORY_SITE.managerUserId
          ? SHARED_FACTORY_SITE.managerTeamMemberId
          : person.id === SHARED_FACTORY_SITE.leadUserId
            ? SHARED_FACTORY_SITE.leadTeamMemberId
            : stableUuid(person.id, "team-member");
      attendances.push({
        id: stableUuid(projectCode, "attendance", sessionId, teamMemberId),
        sessionId,
        teamMemberId,
        status: (index + teamMemberId.length) % 5 === 0 ? "Absent" : "Present",
        notes: (index + teamMemberId.length) % 5 === 0 ? "Shift cover arranged" : "",
        recordedAt: isoAt(-24 + index, 60),
      });
    }
  }

  const pmTasks = Array.from({ length: 8 }, (_, index) => ({
    Ref: `${projectCode}-T-${index + 1}`,
    Status: index % 3 === 0 ? "Open" : "Closed",
    Location: locations[index % locations.length].displayLabel,
    Description: scenarioByIndex(scenarios, index).summary,
    Created: `2026-03-${String((index % 20) + 1).padStart(2, "0")}`,
    Target: `2026-03-${String((index % 20) + 6).padStart(2, "0")}`,
    Type: scenarioByIndex(scenarios, index).category,
    "To Package": scenarioByIndex(scenarios, index).vendor,
    "Status Changed": `2026-03-${String((index % 20) + 2).padStart(2, "0")}`,
    Association: "FactoryWorkflow",
    OverDue: index % 4 === 0 ? "TRUE" : "FALSE",
    Images: "TRUE",
    Comments: "FALSE",
    Documents: "FALSE",
    Priority: scenarioByIndex(scenarios, index).severity,
    Cause: scenarioByIndex(scenarios, index).blockerSubtype,
    project: contractId,
    "Report Status": index % 3 === 0 ? "Open" : "Closed",
    "Task Group": scenarioByIndex(scenarios, index).department,
  }));

  const pmForms = Array.from({ length: 6 }, (_, index) => ({
    Ref: `${projectCode}-F-${index + 1}`,
    Status: "Opened",
    Location: locations[index % locations.length].displayLabel,
    Name: `${projectCode} operational form ${index + 1}`,
    Created: `2026-03-${String((index % 20) + 1).padStart(2, "0")}`,
    Type: variant === "Packaging" ? "Packaging Checklist" : "Process Checklist",
    "Status Changed": `2026-03-${String((index % 20) + 1).padStart(2, "0")}`,
    "Open Actions": "0",
    "Total Actions": "0",
    Association: "",
    OverDue: "FALSE",
    Images: "TRUE",
    Comments: "FALSE",
    Documents: "FALSE",
    Project: contractId,
    "Report Forms Status": "Open",
    "Report Forms Group": variant === "Packaging" ? "Packaging" : "Production",
  }));

  return {
    users,
    teamMembers,
    site: buildSite(contractId),
    project,
    updates,
    updateAi,
    updateAttachments,
    riskEffects,
    riskActions,
    tasks,
    taskAttachments,
    attendanceSessions,
    attendances,
    pmTasks,
    pmForms,
  };
}

async function generateBundleFiles(repoRoot, config) {
  const demoRoot = path.join(repoRoot, "docs", "demo", "datasets");
  const bundleDir = path.join(demoRoot, config.projectCode);
  const locations = buildLocations(
    config.projectCode,
    config.locationPrefix,
    "Factory",
    config.variant === "Packaging" ? PACKAGING_LOCATIONS : PROCESS_LOCATIONS
  );
  const bundle = buildBundle({
    contractId: config.contractId,
    projectCode: config.projectCode,
    variant: config.variant,
    locationPrefix: config.locationPrefix,
    locations,
    scenarios: config.variant === "Packaging" ? PACKAGING_SCENARIOS : PROCESS_SCENARIOS,
    rows: config.rows,
  });

  await fs.rm(bundleDir, { recursive: true, force: true });
  await fs.mkdir(bundleDir, { recursive: true });

  await writeCsv(path.join(bundleDir, "users.csv"), [
    "id",
    "email",
    "name",
    "role",
    "department",
    "specialty",
    "phone",
    "employeeId",
    "avatarUrl",
    "preferences_pushNotificationsEnabled",
    "preferences_darkModeEnabled",
    "createdAt",
    "updatedAt",
  ], bundle.users);

  await writeCsv(path.join(bundleDir, "sites.csv"), [
    "id",
    "name",
    "code",
    "address",
    "locationLatitude",
    "locationLongitude",
    "projectManagerId",
    "isActive",
    "metadata",
    "createdAt",
    "updatedAt",
  ], [bundle.site]);

  await writeCsv(path.join(bundleDir, "projects.csv"), [
    "id",
    "siteId",
    "code",
    "name",
    "description",
    "isActive",
    "metadata",
    "createdAt",
    "updatedAt",
  ], [bundle.project]);

  await writeCsv(path.join(bundleDir, "locations.csv"), [
    "id",
    "projectCode",
    "siteType",
    "level1",
    "level2",
    "level3",
    "level4",
    "displayLabel",
    "isActive",
    "sortOrder",
  ], locations);

  await writeCsv(path.join(bundleDir, "team_members.csv"), [
    "id",
    "siteId",
    "name",
    "role",
    "department",
    "specialty",
    "reportsToUserId",
    "email",
    "phone",
    "isActive",
    "joinedAt",
    "createdAt",
    "updatedAt",
  ], bundle.teamMembers);

  await writeCsv(path.join(bundleDir, "updates.csv"), [
    "id",
    "siteId",
    "projectId",
    "locationId",
    "recordedBy",
    "linkedTaskId",
    "transcript",
    "audioUrl",
    "audioDuration",
    "status",
    "createdAt",
    "updatedAt",
    "isRead",
    "readAt",
  ], bundle.updates);

  await writeCsv(path.join(bundleDir, "update_ai_outputs.csv"), [
    "updateId",
    "category",
    "department",
    "location",
    "locationId",
    "vendor",
    "severity",
    "ownerRole",
    "ownerId",
    "dueDate",
    "generatedTaskDescription",
    "riskImpact",
    "scheduleRisk",
    "confidence",
    "blockerSubtype",
    "locationBlock",
    "locationZone",
    "locationLevel",
    "locationArea",
    "reviewRequired",
    "reviewPrompt",
    "reviewReasonsJson",
    "reviewFieldsJson",
    "reviewedAt",
    "reviewedBy",
  ], bundle.updateAi);

  await writeCsv(path.join(bundleDir, "update_attachments.csv"), [
    "id",
    "updateId",
    "taskId",
    "url",
    "type",
    "uploadedAt",
  ], bundle.updateAttachments);

  await writeCsv(path.join(bundleDir, "update_risk_downstream_effects.csv"), [
    "updateId",
    "order",
    "effect",
  ], bundle.riskEffects);

  await writeCsv(path.join(bundleDir, "update_risk_recommended_actions.csv"), [
    "updateId",
    "order",
    "action",
  ], bundle.riskActions);

  await writeCsv(path.join(bundleDir, "tasks.csv"), [
    "id",
    "siteId",
    "projectId",
    "title",
    "description",
    "ownerId",
    "assigneeRole",
    "severity",
    "department",
    "location",
    "locationId",
    "status",
    "source",
    "sourceUpdateId",
    "startDate",
    "dueDate",
    "completedAt",
    "createdAt",
    "updatedAt",
  ], bundle.tasks);

  await writeCsv(path.join(bundleDir, "task_attachments.csv"), [
    "id",
    "taskId",
    "url",
    "type",
    "uploadedAt",
  ], bundle.taskAttachments);

  await writeCsv(path.join(bundleDir, "attendance_sessions.csv"), [
    "id",
    "siteId",
    "projectId",
    "sessionDate",
    "conductedBy",
    "createdAt",
    "updatedAt",
  ], bundle.attendanceSessions);

  await writeCsv(path.join(bundleDir, "attendances.csv"), [
    "id",
    "sessionId",
    "teamMemberId",
    "status",
    "notes",
    "recordedAt",
  ], bundle.attendances);

  await writeCsv(path.join(bundleDir, `pm_tasks_contract_${config.contractId}.csv`), [
    "Ref",
    "Status",
    "Location",
    "Description",
    "Created",
    "Target",
    "Type",
    "To Package",
    "Status Changed",
    "Association",
    "OverDue",
    "Images",
    "Comments",
    "Documents",
    "Priority",
    "Cause",
    "project",
    "Report Status",
    "Task Group",
  ], bundle.pmTasks);

  await writeCsv(path.join(bundleDir, `pm_forms_contract_${config.contractId}.csv`), [
    "Ref",
    "Status",
    "Location",
    "Name",
    "Created",
    "Type",
    "Status Changed",
    "Open Actions",
    "Total Actions",
    "Association",
    "OverDue",
    "Images",
    "Comments",
    "Documents",
    "Project",
    "Report Forms Status",
    "Report Forms Group",
  ], bundle.pmForms);
}

async function main() {
  const repoRoot = process.cwd();
  const rowsArg = process.argv.find((arg) => arg.startsWith("--rows="));
  const rows = rowsArg ? Number(rowsArg.slice("--rows=".length)) : DEFAULT_ROWS;

  const bundles = [
    {
      contractId: "2101",
      projectCode: "PROC-2101",
      variant: "Process",
      locationPrefix: "loc-proc",
      rows,
    },
    {
      contractId: "2102",
      projectCode: "PKG-2102",
      variant: "Packaging",
      locationPrefix: "loc-pkg",
      rows,
    },
  ];

  for (const bundle of bundles) {
    await generateBundleFiles(repoRoot, bundle);
  }

  console.log(`Generated factory demo bundles with ${rows} tasks/updates each.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
