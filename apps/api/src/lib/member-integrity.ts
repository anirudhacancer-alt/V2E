import { and, eq, isNull } from "drizzle-orm";
import { teamMembers, roleTypes } from "@v2e/database";

import { getDemoDb } from "../db.js";
import { DataIntegrityError } from "./data-integrity.js";

export async function assertNoUnresolvedMemberRoles(
  db: ReturnType<typeof getDemoDb>,
  siteId: string,
  context: Record<string, unknown>
) {
  const bad = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .leftJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
    .where(and(eq(teamMembers.siteId, siteId), isNull(roleTypes.code)));
  if (bad.length > 0) {
    throw new DataIntegrityError(
      "team_members.orgRoleCode not present in role_types",
      { ...context, siteId, teamMemberIds: bad.map((b) => b.id) }
    );
  }
}
