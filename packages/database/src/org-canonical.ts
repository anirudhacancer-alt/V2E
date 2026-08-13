import { mapLegacyUserRoleToOrg, normalizeDepartmentCode } from "./demo-seed/org-mappings.js";

/** Maps `OrgRoleEnum`-style strings to `role_types.code` (see `docs/demo/datasets/shared/role_types.csv`). */
export function pascalOrgRoleToRoleTypeCode(orgRole: string): string {
  const t = orgRole.trim();
  const m: Record<string, string> = {
    HeadOfLogistics: "HEAD_OF_LOGISTICS",
    SiteManager: "SITE_MANAGER",
    PlantManager: "PLANT_MANAGER",
    SiteSupervisor: "SITE_SUPERVISOR",
    ShiftSupervisor: "SHIFT_SUPERVISOR",
    DepartmentSupervisor: "DEPARTMENT_SUPERVISOR",
    LineSupervisor: "LINE_SUPERVISOR",
    QualityLead: "QUALITY_LEAD",
    AreaManager: "AREA_MANAGER",
    LogisticsLead: "LOGISTICS_LEAD",
    Engineer: "ENGINEER",
    MaintenanceEngineer: "MAINTENANCE_ENGINEER",
    Foreman: "FOREMAN",
    Technician: "TECHNICIAN",
    Operator: "OPERATOR",
    Storekeeper: "STOREKEEPER",
    SalesRep: "SALES_REP",
    Worker: "WORKER",
  };
  if (m[t]) return m[t];
  return toRoleTypeCodeCandidate(t) || "WORKER";
}

/** Legacy `UserRoleEnum` / task `assigneeRole` / AI `ownerRole` → canonical `role_types.code`. */
export function legacyUserRoleStringToRoleTypeCode(role: string | undefined | null): string {
  const r = (role ?? "").trim();
  if (!r) return "WORKER";
  const fromOrg = mapLegacyUserRoleToOrg(r).orgRole.trim();
  if (fromOrg) {
    return pascalOrgRoleToRoleTypeCode(fromOrg);
  }
  const candidate = toRoleTypeCodeCandidate(r);
  if (candidate) {
    return candidate;
  }
  return "WORKER";
}

function toRoleTypeCodeCandidate(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^[A-Z][A-Z0-9_]*$/.test(t)) {
    return t;
  }
  return t
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/** Department label / enum name → `departments.code` (same string as master `code`). */
export function departmentStringToCode(
  dept: string | undefined | null
): string | null {
  const d = normalizeDepartmentCode((dept ?? "").trim());
  if (!d) return null;
  return d;
}

/**
 * Map AI extraction / free-text owner role to `role_types.code`.
 * Handles legacy enum-style strings, SCREAMING_SNAKE codes, and common display labels.
 */
export function extractionOwnerRoleToRoleTypeCode(raw: string): string {
  const t = raw.trim();
  if (!t) return "WORKER";
  if (/^[A-Z][A-Z0-9_]*$/.test(t) && t.includes("_")) {
    return t;
  }
  const lower = t.toLowerCase();
  const display: Record<string, string> = {
    "site supervisor": "SITE_SUPERVISOR",
    "site manager": "SITE_MANAGER",
    "shift supervisor": "SHIFT_SUPERVISOR",
    "plant manager": "PLANT_MANAGER",
    "line supervisor": "LINE_SUPERVISOR",
    "quality lead": "QUALITY_LEAD",
    "maintenance engineer": "MAINTENANCE_ENGINEER",
    "head of logistics": "HEAD_OF_LOGISTICS",
    "logistics head": "HEAD_OF_LOGISTICS",
    "area manager": "AREA_MANAGER",
    "sales manager": "AREA_MANAGER",
    "field sales manager": "AREA_MANAGER",
    "logistics lead": "LOGISTICS_LEAD",
    "sales rep": "SALES_REP",
    "field rep": "SALES_REP",
    operator: "OPERATOR",
    storekeeper: "STOREKEEPER",
    "department supervisor": "DEPARTMENT_SUPERVISOR",
    engineer: "ENGINEER",
    foreman: "FOREMAN",
    technician: "TECHNICIAN",
    worker: "WORKER",
  };
  if (display[lower]) return display[lower];
  return legacyUserRoleStringToRoleTypeCode(t);
}
