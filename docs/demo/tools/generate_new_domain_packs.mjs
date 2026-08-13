#!/usr/bin/env node

/**
 * Generate skeleton demo datasets for new domain packs (§18 expansion)
 *
 * Generates minimal but valid datasets for:
 * - RGM-3101 (Retail Go-to-Market)
 * - WH-3201 (Warehouse)
 * - VEN-3203 (Venue)
 * - HC-3204 (Healthcare)
 * - NGO-3205 (NGO Field Operations)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stableUuid(seedString) {
  const hash = createHash("sha256").update(seedString).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

const DOMAIN_PACKS = [
  {
    key: "RGM-3101",
    prefix: "RGM",
    contractId: "3101",
    domain: "RetailGoToMarket",
    bundleVariant: "Retail",
    siteName: "Metro Central Retail Hub",
    siteCode: "SITE-RGM-METRO",
    siteAddress: "Retail Park, Sector 15, Mumbai",
    projectName: "Q2 Perfect Store Execution",
    projectCode: "RGM-3101",
    leadName: "Priya Sharma",
    leadEmail: "asm.retail@demo.local",
    leadRole: "AreaSalesManager",
    locations: [
      ["Store Zone", "Store Front", "Entry Display", "Promo Bay 1"],
      ["Store Zone", "Checkout Zone", "Register Area", "Queue Lane"],
      ["Store Zone", "Shelf Bay", "Aisle 5", "Dairy Section"],
      ["Store Zone", "Cold Storage", "Refrigerated Wall", "Beverage Rack"],
      ["Back of House", "Backroom", "Receiving Dock", "Staging Area"],
      ["Store Zone", "Promotion Display", "Endcap", "Feature Stack"],
    ],
    taskScenarios: [
      { title: "Planogram compliance audit - Aisle 5", severity: "Medium", department: "Sales", status: "In-progress" },
      { title: "SKU availability check - dairy section", severity: "High", department: "Operations", status: "Planned" },
      { title: "Promo display setup - weekly feature", severity: "Medium", department: "Merchandising", status: "Done" },
      { title: "Competitor price audit - key SKUs", severity: "Low", department: "Sales", status: "In-progress" },
      { title: "Stock rotation - near-expiry items", severity: "High", department: "Operations", status: "Blocked" },
    ],
    updateScenarios: [
      { transcript: "Just finished the planogram audit in aisle 5. Found 3 SKUs out of position, corrected them. Facing compliance now at 92%.", status: "Processed" },
      { transcript: "Dairy section has low stock on yogurt SKUs. Requested replenishment from backroom. Expected delivery by afternoon.", status: "CreatedNewTask" },
      { transcript: "Promo display for the weekly feature is set up. Took photos for compliance. Endcap looks good.", status: "Processed" },
      { transcript: "Noticed competitor has dropped prices on key beverage SKUs by 5%. Flagging for pricing team review.", status: "Escalated" },
    ],
  },
  {
    key: "WH-3201",
    prefix: "WH",
    contractId: "3201",
    domain: "WarehouseLogistics",
    bundleVariant: "Warehouse",
    siteName: "Central Distribution Center",
    siteCode: "SITE-WH-CDC",
    siteAddress: "Logistics Park, Bhiwandi, Maharashtra",
    projectName: "DC Operations Q2",
    projectCode: "WH-3201",
    leadName: "Vikram Patel",
    leadEmail: "warehouse.supervisor@demo.local",
    leadRole: "WarehouseSupervisor",
    locations: [
      ["Inbound", "Receiving Dock", "Door 1", "Staging Lane A"],
      ["Storage", "Putaway Zone", "Rack Row A", "Bay 12"],
      ["Operations", "Picking Area", "Zone B", "Pick Station 3"],
      ["Outbound", "Packing Station", "Pack Line 1", "Workstation 2"],
      ["Outbound", "Shipping Dock", "Door 5", "Pre-load Area"],
      ["Storage", "Cold Room", "Frozen Section", "Rack C"],
      ["Returns", "Returns Bay", "Processing Area", "Inspection Desk"],
    ],
    taskScenarios: [
      { title: "Cycle count - Rack Row A", severity: "Medium", department: "Inventory", status: "In-progress" },
      { title: "Dock scheduling - inbound shipments", severity: "High", department: "Receiving", status: "Planned" },
      { title: "WMS exception - putaway failure", severity: "High", department: "Operations", status: "Blocked" },
      { title: "Carrier pickup coordination - Door 5", severity: "Medium", department: "Shipping", status: "Done" },
      { title: "Damage report - pallet inspection", severity: "Low", department: "Quality", status: "In-progress" },
    ],
    updateScenarios: [
      { transcript: "Cycle count in Rack Row A completed. Found 2 discrepancies - adjusting inventory in WMS now.", status: "Processed" },
      { transcript: "Inbound truck for Door 1 is delayed by 2 hours. Rescheduling dock allocation and notifying receiving team.", status: "CreatedNewTask" },
      { transcript: "WMS putaway task failed for pallet P-4521. System shows location conflict. Need IT support to resolve.", status: "Escalated" },
      { transcript: "Carrier pickup complete at Door 5. 45 pallets shipped. BOL signed and scanned.", status: "Processed" },
    ],
  },
  {
    key: "VEN-3203",
    prefix: "VEN",
    contractId: "3203",
    domain: "VenueOperations",
    bundleVariant: "Venue",
    siteName: "Arena Grand Events Center",
    siteCode: "SITE-VEN-ARENA",
    siteAddress: "Entertainment District, Hyderabad",
    projectName: "Spring Concert Series",
    projectCode: "VEN-3203",
    leadName: "Ananya Gupta",
    leadEmail: "venue.manager@demo.local",
    leadRole: "VenueManager",
    locations: [
      ["Main Venue", "Main Hall", "Stage Area", "Center Stage"],
      ["VIP", "VIP Lounge", "Green Room", "Artist Suite"],
      ["Backstage", "Backstage", "Loading Dock", "Equipment Bay"],
      ["Operations", "Control Room", "AV Booth", "Sound Desk"],
      ["Entry", "Entry Gate", "Gate A", "Security Check"],
      ["F&B", "Concession Stand", "Stand 3", "Service Counter"],
      ["Facilities", "Restroom Block", "Block A", "Main Corridor"],
    ],
    taskScenarios: [
      { title: "AV setup - main stage sound check", severity: "High", department: "Production", status: "In-progress" },
      { title: "Security briefing - crowd management", severity: "High", department: "Security", status: "Planned" },
      { title: "F&B inventory check - concession stands", severity: "Medium", department: "F&B", status: "Done" },
      { title: "Emergency exit verification", severity: "Critical", department: "Safety", status: "In-progress" },
      { title: "VIP lounge setup - artist requirements", severity: "Medium", department: "Hospitality", status: "Blocked" },
    ],
    updateScenarios: [
      { transcript: "Sound check complete for main stage. Levels are set, monitors are calibrated. Ready for rehearsal at 4 PM.", status: "Processed" },
      { transcript: "Security team briefing done. All 24 guards assigned positions. Crowd control plan reviewed.", status: "Processed" },
      { transcript: "Emergency exit B2 has a faulty latch. Maintenance dispatched. Cannot clear safety check until fixed.", status: "Escalated" },
      { transcript: "VIP lounge missing requested items from artist rider. Procurement team notified for urgent delivery.", status: "CreatedNewTask" },
    ],
  },
  {
    key: "HC-3204",
    prefix: "HC",
    contractId: "3204",
    domain: "HealthcareOperations",
    bundleVariant: "Healthcare",
    siteName: "City Health Clinic",
    siteCode: "SITE-HC-CHC",
    siteAddress: "Healthcare Complex, Bengaluru",
    projectName: "Clinic Operations Q2",
    projectCode: "HC-3204",
    leadName: "Dr. Rajesh Kumar",
    leadEmail: "ops.lead.healthcare@demo.local",
    leadRole: "OperationsLead",
    locations: [
      ["Front Office", "Reception", "Main Desk", "Registration Counter"],
      ["Patient Area", "Waiting Area", "Zone A", "Seating Section"],
      ["Clinical", "Examination Room", "Room 3", "Consultation Bay"],
      ["Support", "Pharmacy", "Dispensary", "Pickup Counter"],
      ["Support", "Lab", "Sample Collection", "Draw Station 2"],
      ["Back Office", "Storage Room", "Medical Supplies", "Rack B"],
      ["Admin", "Admin Office", "Operations Hub", "Desk 1"],
    ],
    taskScenarios: [
      { title: "Equipment calibration - diagnostic devices", severity: "High", department: "Biomedical", status: "In-progress" },
      { title: "Supply inventory - medical consumables", severity: "Medium", department: "Supply Chain", status: "Planned" },
      { title: "Cleaning schedule - examination rooms", severity: "Medium", department: "Facilities", status: "Done" },
      { title: "Regulatory compliance check - pharmacy", severity: "High", department: "Compliance", status: "In-progress" },
      { title: "HVAC maintenance - waiting area", severity: "Low", department: "Facilities", status: "Blocked" },
    ],
    updateScenarios: [
      { transcript: "Equipment calibration for Room 3 diagnostic devices complete. All readings within tolerance. Logged in maintenance system.", status: "Processed" },
      { transcript: "Supply inventory shows low stock on PPE items. Raised purchase order for immediate replenishment.", status: "CreatedNewTask" },
      { transcript: "Pharmacy compliance check found minor documentation gap. Corrective action initiated.", status: "Processed" },
      { transcript: "HVAC unit in waiting area making noise. Vendor scheduled but parts on backorder. Temporary fans deployed.", status: "Escalated" },
    ],
  },
  {
    key: "NGO-3205",
    prefix: "NGO",
    contractId: "3205",
    domain: "NGOFieldOperations",
    bundleVariant: "NGO",
    siteName: "Community Outreach Hub",
    siteCode: "SITE-NGO-COH",
    siteAddress: "Rural Development Zone, Rajasthan",
    projectName: "Health & Education Initiative Q2",
    projectCode: "NGO-3205",
    leadName: "Meera Krishnan",
    leadEmail: "field.coordinator.ngo@demo.local",
    leadRole: "FieldCoordinator",
    locations: [
      ["Field", "Field Site", "Village A", "Community Center"],
      ["Field", "Field Site", "Village B", "School Grounds"],
      ["Hub", "Community Center", "Main Hall", "Training Room"],
      ["Distribution", "Distribution Point", "Supply Station", "Pickup Area"],
      ["Mobile", "Mobile Unit", "Health Van", "Screening Bay"],
      ["Admin", "Camp Office", "Field HQ", "Coordination Desk"],
      ["Registration", "Registration Desk", "Entry Point", "Data Collection"],
    ],
    taskScenarios: [
      { title: "Field visit - Village A health camp", severity: "High", department: "Health", status: "In-progress" },
      { title: "Beneficiary registration - education program", severity: "Medium", department: "Education", status: "Planned" },
      { title: "Supply distribution - nutrition kits", severity: "High", department: "Logistics", status: "Done" },
      { title: "Community feedback collection", severity: "Low", department: "Monitoring", status: "In-progress" },
      { title: "Escalation - water supply issue Village B", severity: "Critical", department: "WASH", status: "Blocked" },
    ],
    updateScenarios: [
      { transcript: "Health camp in Village A completed. 87 beneficiaries screened. 12 referrals for follow-up. Photos and data uploaded.", status: "Processed" },
      { transcript: "Education program registration ongoing. 45 children enrolled so far. Need additional volunteer support.", status: "CreatedNewTask" },
      { transcript: "Nutrition kit distribution complete. 120 kits distributed. Stock remaining: 30 kits.", status: "Processed" },
      { transcript: "Water supply in Village B non-functional for 3 days. Community is using unsafe sources. Escalating to district coordinator.", status: "Escalated" },
    ],
  },
  // ============================================================================
  // Additional packs - RGM-3102 and FAC-3202
  // ============================================================================
  {
    key: "RGM-3102",
    prefix: "RGM2",
    contractId: "3102",
    domain: "RetailGoToMarket",
    bundleVariant: "Retail",
    siteName: "South Zone Hypermarket Chain",
    siteCode: "SITE-RGM-SOUTH",
    siteAddress: "Commercial Complex, Koramangala, Bengaluru",
    projectName: "Seasonal Campaign Q2",
    projectCode: "RGM-3102",
    leadName: "Arjun Reddy",
    leadEmail: "rsm.south@demo.local",
    leadRole: "RegionalSalesManager",
    locations: [
      ["Store Zone", "Main Floor", "Seasonal Display", "Festival Aisle"],
      ["Store Zone", "Checkout Zone", "Express Counter", "Self-Checkout"],
      ["Store Zone", "Fresh Section", "Produce Area", "Organic Bay"],
      ["Store Zone", "FMCG Aisle", "Beverage Wall", "Impulse Rack"],
      ["Back of House", "Cold Chain", "Walk-in Cooler", "Dairy Store"],
      ["Store Zone", "Electronics", "Demo Counter", "Accessory Wall"],
    ],
    taskScenarios: [
      { title: "Seasonal display setup - Diwali campaign", severity: "High", department: "Merchandising", status: "In-progress" },
      { title: "Competitor price monitoring - FMCG category", severity: "Medium", department: "Sales", status: "Planned" },
      { title: "Cold chain temperature audit", severity: "Critical", department: "Quality", status: "In-progress" },
      { title: "Self-checkout machine maintenance", severity: "Medium", department: "IT", status: "Done" },
      { title: "Fresh produce rotation - near-expiry", severity: "High", department: "Operations", status: "Blocked" },
      { title: "Staff training - new POS system", severity: "Low", department: "HR", status: "Planned" },
    ],
    updateScenarios: [
      { transcript: "Diwali seasonal display is 80% complete. Waiting for additional stock of gift packs. Expected tomorrow.", status: "CreatedNewTask" },
      { transcript: "Competitor has launched 15% off on beverages. Our pricing team needs to review response strategy.", status: "Escalated" },
      { transcript: "Cold chain audit complete. Walk-in cooler showing 2 degrees above threshold. Technician dispatched.", status: "Escalated" },
      { transcript: "Self-checkout machines all operational after firmware update. Customer wait times reduced by 30%.", status: "Processed" },
      { transcript: "Fresh produce section reorganized. Removed 45 kg near-expiry items for markdown sale.", status: "Processed" },
    ],
  },
  {
    key: "FAC-3202",
    prefix: "FAC",
    contractId: "3202",
    domain: "FactoryMaintenance",
    bundleVariant: "Factory",
    siteName: "Precision Engineering Works",
    siteCode: "SITE-FAC-PEW",
    siteAddress: "Industrial Area Phase 2, Pune",
    projectName: "TPM Excellence Program",
    projectCode: "FAC-3202",
    leadName: "Suresh Kulkarni",
    leadEmail: "maintenance.lead@demo.local",
    leadRole: "MaintenanceLead",
    locations: [
      ["Production", "CNC Zone", "Machine Bay 1", "CNC-401"],
      ["Production", "CNC Zone", "Machine Bay 2", "CNC-402"],
      ["Production", "Assembly Line", "Station A", "Workbench 3"],
      ["Utilities", "Compressor Room", "Air System", "Compressor 2"],
      ["Utilities", "Electrical Room", "MCC Panel", "Panel B"],
      ["Maintenance", "Tool Crib", "Spare Parts", "Rack 12"],
      ["Quality", "CMM Room", "Inspection Bay", "CMM-01"],
    ],
    taskScenarios: [
      { title: "Preventive maintenance - CNC-401 spindle", severity: "High", department: "Maintenance", status: "In-progress" },
      { title: "Kaizen - reduce changeover time Line A", severity: "Medium", department: "Production", status: "Planned" },
      { title: "Breakdown repair - Compressor 2 motor", severity: "Critical", department: "Utilities", status: "Blocked" },
      { title: "5S audit - Tool Crib organization", severity: "Low", department: "Quality", status: "Done" },
      { title: "Calibration due - CMM machine", severity: "High", department: "Quality", status: "In-progress" },
      { title: "Electrical panel thermal scan", severity: "Medium", department: "Safety", status: "Planned" },
      { title: "OEE improvement - Assembly Station A", severity: "Medium", department: "Production", status: "In-progress" },
    ],
    updateScenarios: [
      { transcript: "CNC-401 spindle maintenance in progress. Bearing replacement done, alignment check pending. Machine back online by 4 PM.", status: "Processed" },
      { transcript: "Kaizen team identified 3 improvement ideas for changeover reduction. Piloting SMED approach next week.", status: "CreatedNewTask" },
      { transcript: "Compressor 2 motor failed. Replacement motor on order, ETA 48 hours. Running on backup compressor.", status: "Escalated" },
      { transcript: "5S audit complete in Tool Crib. Score improved from 3.2 to 4.1. Shadow boards installed for all hand tools.", status: "Processed" },
      { transcript: "CMM calibration scheduled with vendor for Friday. Production planning adjusted to avoid inspection backlog.", status: "Processed" },
      { transcript: "Thermal scan of MCC Panel B shows hotspot on breaker CB-15. Scheduling replacement during weekend shutdown.", status: "Escalated" },
    ],
  },
];

async function generateDataset(pack) {
  const datasetDir = path.join(__dirname, "..", "datasets", pack.key);

  // Create directory
  await fs.mkdir(datasetDir, { recursive: true });

  const now = new Date().toISOString();
  const siteId = stableUuid(`${pack.prefix}-site`);
  const projectId = stableUuid(`${pack.prefix}-project`);
  const leadUserId = stableUuid(`${pack.prefix}-lead-user`);
  const leadTeamMemberId = stableUuid(`${pack.prefix}-lead-tm`);

  // Generate users.csv
  const usersContent = [
    "id,email,name,role,phone,employeeId,avatarUrl,preferences_pushNotificationsEnabled,preferences_darkModeEnabled,createdAt,updatedAt",
    `${leadUserId},${pack.leadEmail},${pack.leadName},${pack.leadRole},+91-9876543210,EMP-${pack.prefix}-001,,false,false,${now},${now}`,
  ].join("\n");
  await fs.writeFile(path.join(datasetDir, "users.csv"), usersContent);

  // Generate sites.csv
  const sitesContent = [
    "id,name,code,address,locationLatitude,locationLongitude,projectManagerId,isActive,metadata,createdAt,updatedAt",
    `${siteId},${pack.siteName},${pack.siteCode},${pack.siteAddress},0.0,0.0,${leadUserId},true,{},${now},${now}`,
  ].join("\n");
  await fs.writeFile(path.join(datasetDir, "sites.csv"), sitesContent);

  // Generate projects.csv
  const projectsContent = [
    "id,siteId,code,name,description,isActive,metadata,createdAt,updatedAt",
    `${projectId},${siteId},${pack.projectCode},${pack.projectName},Demo project for ${pack.domain},true,{},${now},${now}`,
  ].join("\n");
  await fs.writeFile(path.join(datasetDir, "projects.csv"), projectsContent);

  // Generate locations.csv
  const locationsRows = ["id,projectCode,siteType,level1,level2,level3,level4,displayLabel,isActive,sortOrder"];
  pack.locations.forEach((loc, i) => {
    const locId = stableUuid(`${pack.prefix}-loc-${i}`);
    const displayLabel = loc.filter(Boolean).join(" > ");
    locationsRows.push(`${locId},${pack.projectCode},${pack.bundleVariant},${loc[0]},${loc[1]},${loc[2] || ""},${loc[3] || ""},${displayLabel},1,${i + 1}`);
  });
  await fs.writeFile(path.join(datasetDir, "locations.csv"), locationsRows.join("\n"));

  // Generate team_members.csv
  const teamMembersContent = [
    "id,siteId,name,role,email,phone,isActive,joinedAt,createdAt,updatedAt",
    `${leadTeamMemberId},${siteId},${pack.leadName},${pack.leadRole},${pack.leadEmail},+91-9876543210,true,${now},${now},${now}`,
  ].join("\n");
  await fs.writeFile(path.join(datasetDir, "team_members.csv"), teamMembersContent);

  // Generate tasks.csv
  const tasksRows = ["id,siteId,projectId,title,description,ownerId,assigneeRole,severity,department,location,locationId,status,source,sourceUpdateId,startDate,dueDate,completedAt,createdAt,updatedAt"];
  pack.taskScenarios.forEach((task, i) => {
    const taskId = stableUuid(`${pack.prefix}-task-${i}`);
    const locId = stableUuid(`${pack.prefix}-loc-${i % pack.locations.length}`);
    const dueDate = new Date(Date.now() + (7 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const completedAt = task.status === "Done" ? now : "";
    tasksRows.push(`${taskId},${siteId},${projectId},${task.title},Task description for ${pack.domain},${leadTeamMemberId},${pack.leadRole},${task.severity},${task.department},Location ${i + 1},${locId},${task.status},Manual,,${startDate},${dueDate},${completedAt},${now},${now}`);
  });
  await fs.writeFile(path.join(datasetDir, "tasks.csv"), tasksRows.join("\n"));

  // Generate updates.csv
  const updatesRows = ["id,siteId,projectId,locationId,recordedBy,linkedTaskId,transcript,audioUrl,audioDuration,status,createdAt,updatedAt,isRead,readAt"];
  pack.updateScenarios.forEach((update, i) => {
    const updateId = stableUuid(`${pack.prefix}-update-${i}`);
    const locId = stableUuid(`${pack.prefix}-loc-${i % pack.locations.length}`);
    updatesRows.push(`${updateId},${siteId},${projectId},${locId},${leadTeamMemberId},,${update.transcript},,120,${update.status},${now},${now},0,`);
  });
  await fs.writeFile(path.join(datasetDir, "updates.csv"), updatesRows.join("\n"));

  // Generate update_ai_outputs.csv (minimal)
  const updateAiRows = ["updateId,category,department,location,locationId,blockerSubtype,locationBlock,locationZone,locationLevel,locationArea,vendor,severity,ownerRole,ownerId,dueDate,generatedTaskDescription,riskImpact,scheduleRisk,confidence,reviewRequired,reviewPrompt,reviewReasonsJson,reviewFieldsJson,humanReviewRequired,reviewedAt,reviewedBy"];
  pack.updateScenarios.forEach((update, i) => {
    const updateId = stableUuid(`${pack.prefix}-update-${i}`);
    const locId = stableUuid(`${pack.prefix}-loc-${i % pack.locations.length}`);
    const loc = pack.locations[i % pack.locations.length];
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    updateAiRows.push(`${updateId},GeneralUpdate,Operations,${loc.join(" > ")},${locId},,${loc[0]},${loc[1]},${loc[2] || ""},${loc[3] || ""},Team,Medium,${pack.leadRole},${leadTeamMemberId},${dueDate},Auto-generated task from update,Moderate schedule impact,Low,85,0,,[],[],0,,`);
  });
  await fs.writeFile(path.join(datasetDir, "update_ai_outputs.csv"), updateAiRows.join("\n"));

  // Generate empty but valid auxiliary files
  const emptyFiles = [
    { name: "update_attachments.csv", header: "id,updateId,taskId,url,type,uploadedAt" },
    { name: "task_attachments.csv", header: "id,taskId,url,type,uploadedAt" },
    { name: "update_risk_downstream_effects.csv", header: "updateId,order,effect" },
    { name: "update_risk_recommended_actions.csv", header: "updateId,order,action" },
    { name: "attendance_sessions.csv", header: "id,siteId,projectId,sessionDate,conductedBy,createdAt,updatedAt" },
    { name: "attendances.csv", header: "id,sessionId,teamMemberId,status,notes,recordedAt" },
  ];

  for (const file of emptyFiles) {
    await fs.writeFile(path.join(datasetDir, file.name), file.header + "\n");
  }

  console.log(`✓ Generated dataset: ${pack.key}`);
}

async function main() {
  console.log("Generating new domain pack datasets...\n");

  for (const pack of DOMAIN_PACKS) {
    await generateDataset(pack);
  }

  console.log("\nDone! Generated datasets for:");
  DOMAIN_PACKS.forEach(pack => console.log(`  - ${pack.key}: ${pack.domain}`));
}

main().catch(console.error);
