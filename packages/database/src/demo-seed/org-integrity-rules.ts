import {
  departmentStringToCode,
  legacyUserRoleStringToRoleTypeCode,
} from "../org-canonical.js";
import { deriveLocationListLabel } from "../location-list-label.js";
import type { DemoBundleRows } from "./types.js";

function requireMappedRoleType(
  errors: string[],
  context: string,
  roleRaw: string | undefined,
  roleTypeCodes: Set<string>
): void {
  const code = legacyUserRoleStringToRoleTypeCode(roleRaw);
  if (!roleTypeCodes.has(code)) {
    errors.push(
      `${context}: mapped orgRoleCode "${code}" (from role="${roleRaw ?? ""}") is missing from bundle role_types`
    );
  }
}

function requireMappedDepartment(
  errors: string[],
  context: string,
  deptRaw: string | undefined,
  deptCodes: Set<string>
): void {
  const code = departmentStringToCode(deptRaw);
  if (code === null) return;
  if (!deptCodes.has(code)) {
    errors.push(
      `${context}: mapped departmentCode "${code}" (from department="${deptRaw ?? ""}") is missing from bundle departments`
    );
  }
}

/**
 * Same mapping rules as `persist.ts`: every resolved `role_types.code` and
 * non-null `departments.code` must exist in the shared masters; locations must
 * yield a non-empty compact list label for API `listLabel`.
 */
export function validateCanonicalOrgAndLocationLabels(rows: DemoBundleRows): string[] {
  const errors: string[] = [];
  const roleTypeCodes = new Set(
    rows.roleTypes.map((r) => (r.code ?? "").trim()).filter(Boolean)
  );
  const deptCodes = new Set(
    rows.departments.map((d) => (d.code ?? "").trim()).filter(Boolean)
  );

  const userIds = new Set(rows.users.map((u) => u.id.trim()).filter(Boolean));
  const teamMemberIds = new Set(
    rows.teamMembers.map((tm) => tm.id.trim()).filter(Boolean)
  );

  for (const u of rows.users) {
    requireMappedRoleType(errors, `user ${u.id}`, u.role, roleTypeCodes);
    requireMappedDepartment(errors, `user ${u.id}`, u.department, deptCodes);
  }
  for (const tm of rows.teamMembers) {
    requireMappedRoleType(errors, `team_member ${tm.id}`, tm.role, roleTypeCodes);
    requireMappedDepartment(errors, `team_member ${tm.id}`, tm.department, deptCodes);
  }
  for (const t of rows.tasks) {
    requireMappedRoleType(errors, `task ${t.id} assigneeRole`, t.assigneeRole, roleTypeCodes);
    requireMappedDepartment(errors, `task ${t.id}`, t.department, deptCodes);
  }
  for (const ai of rows.updateAi) {
    requireMappedRoleType(errors, `update_ai ${ai.updateId} ownerRole`, ai.ownerRole, roleTypeCodes);
    requireMappedDepartment(errors, `update_ai ${ai.updateId}`, ai.department, deptCodes);
    const oid = ai.ownerId?.trim();
    if (oid && !userIds.has(oid) && !teamMemberIds.has(oid)) {
      errors.push(
        `update_ai ${ai.updateId}: ownerId "${oid}" does not resolve to a user or team_member row`
      );
    }
  }

  for (const s of rows.sites) {
    const pm = s.projectManagerId?.trim();
    if (pm && !userIds.has(pm)) {
      errors.push(`site ${s.id}: projectManagerId "${pm}" does not resolve to a user row`);
    }
  }

  for (const loc of rows.locations) {
    const label = deriveLocationListLabel(loc).trim();
    if (!label) {
      errors.push(
        `location ${loc.id}: deriveLocationListLabel is empty (level1–level4 must produce a non-empty list label)`
      );
    }
  }

  return errors;
}
