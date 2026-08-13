import { eq, inArray } from "drizzle-orm";
import { teamMembers, users, roleTypes } from "@v2e/database";
import type { DemoDb } from "@v2e/database";
import { DataIntegrityError } from "./data-integrity.js";

/**
 * Demo bundles store `recordedBy` / task `ownerId` as either `team_members.id` or `users.id`.
 * Resolves display name and `role_types.name` (inner join — no code fallback).
 */
export async function resolvePersonNameAndRole(
  db: DemoDb,
  id: string
): Promise<{ name: string; role: string }> {
  const [tm] = await db
    .select({
      name: teamMembers.name,
      roleLabel: roleTypes.name,
    })
    .from(teamMembers)
    .innerJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
    .where(eq(teamMembers.id, id));

  if (tm) {
    return { name: tm.name, role: tm.roleLabel };
  }

  const [u] = await db
    .select({
      name: users.name,
      roleLabel: roleTypes.name,
    })
    .from(users)
    .innerJoin(roleTypes, eq(users.orgRoleCode, roleTypes.code))
    .where(eq(users.id, id));

  if (u) {
    return { name: u.name, role: u.roleLabel };
  }

  throw new DataIntegrityError("recordedBy / ownerId does not resolve to a user or team member with a valid org role", {
    id,
  });
}

export async function resolvePersonName(db: DemoDb, id: string): Promise<string> {
  const { name } = await resolvePersonNameAndRole(db, id);
  return name;
}

/**
 * Batch-resolve display names. Every id must exist as team member or user.
 */
export async function resolvePersonNamesByIds(
  db: DemoDb,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const tmRows = await db
    .select({ id: teamMembers.id, name: teamMembers.name })
    .from(teamMembers)
    .where(inArray(teamMembers.id, unique));
  for (const r of tmRows) {
    out.set(r.id, r.name);
  }

  const missingForUsers = unique.filter((i) => !out.has(i));
  if (missingForUsers.length > 0) {
    const uRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, missingForUsers));
    for (const r of uRows) {
      out.set(r.id, r.name);
    }
  }

  const stillMissing = unique.filter((i) => !out.has(i));
  if (stillMissing.length > 0) {
    throw new DataIntegrityError("owner id(s) not found in users or team_members", {
      ids: stillMissing,
    });
  }

  return out;
}

/** Human-readable `role_types.name` for each code; every code must exist. */
export async function resolveRoleTypeLabelsByCodes(
  db: DemoDb,
  codes: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(codes)].filter(Boolean);
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const rows = await db
    .select({ code: roleTypes.code, name: roleTypes.name })
    .from(roleTypes)
    .where(inArray(roleTypes.code, unique));
  for (const r of rows) {
    out.set(r.code, r.name);
  }

  const missing = unique.filter((c) => !out.has(c));
  if (missing.length > 0) {
    throw new DataIntegrityError("assigneeRoleCode / ownerRoleCode not found in role_types", {
      codes: missing,
    });
  }

  return out;
}
