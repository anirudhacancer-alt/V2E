import type { CsvRow } from "./types.js";
import { resolveDemoDatasetPack } from "./domain-packs.js";

/** Shared site supervisor (demo invariant) — task creator for human/manual flows. */
export const DEMO_SITE_SUPERVISOR_USER_ID = "bcea1e0f-b972-4f75-8563-c9f64aa9756f";
export const DEMO_SITE_SUPERVISOR_EMAIL = "supervisor.gurugram@demo.local";
export const DEMO_SITE_SUPERVISOR_NAME = "Narayanan";

export function getDemoLeadIdentity(datasetKey: string) {
  return resolveDemoDatasetPack(datasetKey).leadIdentity;
}

/** Normalize CSV / materialized `department` cell to `DepartmentEnum` codes. */
export function normalizeDepartmentCode(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  switch (t) {
    case "RCC":
    case "Concrete":
      return "Structure";
    case "MEP":
    case "Finishing":
    case "Procurement":
    case "Masonry":
    case "Electrical":
    case "Plumbing":
    case "Carpentry":
    case "Steel":
    case "Painting":
    case "Production":
    case "Packaging":
    case "Maintenance":
    case "Utilities":
    case "Quality":
    case "Warehouse":
      return t;
    default:
      return t;
  }
}

type OrgTriple = { orgRole: string; specialty: string; department: string };

/** Map legacy `UserRoleEnum` / `role` string → org model (Option B). */
export function mapLegacyUserRoleToOrg(role: string | undefined): OrgTriple {
  const r = (role ?? "").trim();
  const table: Record<string, OrgTriple> = {
    SiteManager: { orgRole: "SiteManager", specialty: "General", department: "" },
    SiteSupervisor: { orgRole: "SiteSupervisor", specialty: "General", department: "" },
    PlantManager: { orgRole: "PlantManager", specialty: "General", department: "" },
    ShiftSupervisor: {
      orgRole: "ShiftSupervisor",
      specialty: "Production",
      department: "Production",
    },
    LineSupervisor: {
      orgRole: "LineSupervisor",
      specialty: "Production",
      department: "Production",
    },
    QualityLead: {
      orgRole: "QualityLead",
      specialty: "Quality",
      department: "Quality",
    },
    MaintenanceEngineer: {
      orgRole: "MaintenanceEngineer",
      specialty: "Maintenance",
      department: "Maintenance",
    },
    Operator: { orgRole: "Operator", specialty: "Production", department: "Production" },
    Storekeeper: { orgRole: "Storekeeper", specialty: "Warehouse", department: "Warehouse" },
    HeadOfLogistics: {
      orgRole: "HeadOfLogistics",
      specialty: "Warehouse",
      department: "Warehouse",
    },
    AreaManager: {
      orgRole: "AreaManager",
      specialty: "Sales",
      department: "Planning",
    },
    LogisticsLead: {
      orgRole: "LogisticsLead",
      specialty: "Warehouse",
      department: "Warehouse",
    },
    SalesRep: { orgRole: "SalesRep", specialty: "Sales", department: "Planning" },
    FieldRep: { orgRole: "SalesRep", specialty: "Sales", department: "Planning" },
    MasonLead: { orgRole: "Foreman", specialty: "Masonry", department: "Masonry" },
    ProcurementLead: {
      orgRole: "DepartmentSupervisor",
      specialty: "Procurement",
      department: "Procurement",
    },
    ElectricalSupervisor: {
      orgRole: "DepartmentSupervisor",
      specialty: "Electrical",
      department: "Electrical",
    },
    PaintingContractor: {
      orgRole: "DepartmentSupervisor",
      specialty: "Finishing",
      department: "Finishing",
    },
    CivilEngineer: { orgRole: "Engineer", specialty: "Civil", department: "Civil" },
    SteelFixer: { orgRole: "Worker", specialty: "Steel", department: "Steel" },
    Electrician: { orgRole: "Technician", specialty: "Electrical", department: "Electrical" },
    Plumber: { orgRole: "Technician", specialty: "Plumbing", department: "Plumbing" },
    Carpenter: { orgRole: "Worker", specialty: "Carpentry", department: "Carpentry" },
  };
  return table[r] ?? { orgRole: "", specialty: "", department: "" };
}

/**
 * Populate `department` / org fields and task actor ids after core materialization.
 */
export function applyOrgDepartmentFields(
  datasetKey: string,
  users: CsvRow[],
  teamMembers: CsvRow[],
  tasks: CsvRow[],
  updateAi: CsvRow[]
): void {
  const leadIdentity = getDemoLeadIdentity(datasetKey);

  for (const u of users) {
    const m = mapLegacyUserRoleToOrg(u.role);
    u.department = u.department?.trim() || m.department;
    u.orgRole = u.orgRole?.trim() || m.orgRole;
    u.specialty = u.specialty?.trim() || m.specialty;
  }

  for (const tm of teamMembers) {
    const m = mapLegacyUserRoleToOrg(tm.role);
    tm.department = tm.department?.trim() || m.department;
    tm.orgRole = tm.orgRole?.trim() || m.orgRole;
    tm.specialty = tm.specialty?.trim() || m.specialty;
    if (!tm.reportsToUserId?.trim()) {
      tm.reportsToUserId = "";
    }
  }

  const aiByUpdateId = new Map(updateAi.map((row) => [row.updateId, row]));

  for (const task of tasks) {
    task.department = normalizeDepartmentCode(task.department);
    const sid = task.sourceUpdateId?.trim();
    if (!sid) {
      task.createdBy = leadIdentity.userId;
      task.updatedBy = leadIdentity.userId;
      continue;
    }
    const ai = aiByUpdateId.get(sid);
    const actor = ai?.reviewedBy?.trim() || leadIdentity.userId;
    task.createdBy = actor;
    task.updatedBy = actor;
  }

  for (const row of updateAi) {
    row.department = normalizeDepartmentCode(row.department);
  }
}
