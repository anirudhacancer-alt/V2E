import type { CsvRow } from "./types.js";
import type { DemoDomainPack, SiteTypeKind } from "./domain-packs.js";

/** Join non-empty level fields with middle dot (canonical UI label). */
export function deriveLocationDisplayLabel(row: CsvRow): string {
  const parts = [row.level1, row.level2, row.level3, row.level4]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return parts.join(" · ");
}

/** Substrings that must never appear in demo location labels (PM leakage). */
export const PM_LOCATION_BLOCKLIST = [
  "ITP",
  "QC",
  "BC(A)R",
  "JPC Project Management",
  "EHS",
  "Daily Site Diary",
  ">",
] as const;

function hasHierarchyGap(row: CsvRow): boolean {
  const l2 = (row.level2 ?? "").trim();
  const l3 = (row.level3 ?? "").trim();
  const l4 = (row.level4 ?? "").trim();
  if (!l2 && (l3 || l4)) return true;
  if (!l3 && l4) return true;
  return false;
}

function hasPmLeakage(text: string): string | undefined {
  for (const token of PM_LOCATION_BLOCKLIST) {
    if (text.includes(token)) return token;
  }
  return undefined;
}

function segmentCount(label: string): number {
  return label.split("·").map((s) => s.trim()).filter(Boolean).length;
}

/** Validate master `locations.csv` rows for one project bundle. */
export function validateLocationMasterRows(
  rows: CsvRow[],
  pack: DemoDomainPack
): string[] {
  const errors: string[] = [];
  const labels = new Set<string>();

  for (const row of rows) {
    const id = (row.id ?? "").trim();
    if (!id) errors.push("location row missing id");
    const projectCode = (row.projectCode ?? "").trim();
    if (!projectCode) {
      errors.push(`location ${id || "?"}: missing projectCode (e.g. RES-1328)`);
    }
    const derived = deriveLocationDisplayLabel(row);
    if (!derived) errors.push(`location ${id || "?"}: empty derived display from levels`);

    const csvDisplay = (row.displayLabel ?? "").trim();
    if (csvDisplay && csvDisplay !== derived) {
      errors.push(
        `location ${id}: displayLabel must match derived levels (got "${csvDisplay}", expected "${derived}")`
      );
    }

    const display = derived || csvDisplay;

    if (hasHierarchyGap(row)) {
      errors.push(`location ${id}: invalid level gap (empty level2 with deeper levels)`);
    }

    const leak = hasPmLeakage(display);
    if (leak) errors.push(`location ${id}: forbidden token "${leak}" in derived displayLabel`);

    if (segmentCount(display) > 4) {
      errors.push(`location ${id}: more than 4 segments in displayLabel`);
    }

    if (labels.has(display)) {
      errors.push(`location ${id}: duplicate displayLabel "${display}"`);
    }
    labels.add(display);

    for (const term of pack.locationValidation.forbiddenTerms) {
      if (display.includes(term)) {
        errors.push(
          `location ${id}: ${pack.bundleVariant.toLowerCase()} bundle must not include "${term}"`
        );
      }
    }

    const rowSiteType = (row.siteType ?? "").trim();
    if (rowSiteType && rowSiteType !== pack.siteType) {
      errors.push(
        `location ${id}: siteType must be "${pack.siteType}" for ${pack.datasetPrefix} bundles`
      );
    }
  }

  const union = rows
    .map((r) => deriveLocationDisplayLabel(r) || (r.displayLabel ?? "").trim())
    .join(" | ");

  for (const word of pack.locationValidation.requiredAll) {
    if (!union.includes(word)) {
      errors.push(`${pack.datasetPrefix} locations: require coverage of "${word}"`);
    }
  }

  if (pack.locationValidation.requiredAny?.length) {
    const hasAny = pack.locationValidation.requiredAny.some((word) => union.includes(word));
    if (!hasAny) {
      errors.push(
        `${pack.datasetPrefix} locations: require at least one of ${pack.locationValidation.requiredAny.join(", ")}`
      );
    }
  }

  return errors;
}

export function inferSiteTypeFromLocations(rows: CsvRow[]): SiteTypeKind {
  const siteTypes = new Set(
    rows.map((row) => (row.siteType ?? "").trim()).filter(Boolean) as SiteTypeKind[]
  );
  if (siteTypes.size === 1) {
    const [siteType] = [...siteTypes];
    if (siteType === "Residential" || siteType === "Commercial" || siteType === "Factory") {
      return siteType;
    }
  }
  // Fallback for older bundles or partial data
  const union = rows
    .map((row) => deriveLocationDisplayLabel(row) || (row.displayLabel ?? "").trim())
    .join(" | ");
  if (union.includes("Office Tower") || union.includes("Open Office")) {
    return "Commercial";
  }
  if (
    union.includes("Mixing Hall") ||
    union.includes("Packaging Hall") ||
    union.includes("Cooling Tunnel")
  ) {
    return "Factory";
  }
  return "Residential";
}

/** FK checks for updates.locationId against the location master id set. */
export function validateUpdateLocationLinks(
  updateRows: CsvRow[],
  locationIds: Set<string>
): string[] {
  const errors: string[] = [];
  for (const u of updateRows) {
    const lid = (u.locationId ?? "").trim();
    if (!lid) {
      errors.push(`update ${u.id}: missing locationId`);
      continue;
    }
    if (!locationIds.has(lid)) {
      errors.push(`update ${u.id}: unknown locationId ${lid}`);
    }
  }
  return errors;
}

/** FK + label checks for tasks and AI rows against a location id set. */
export function validateTaskAndAiLocationLinks(
  tasks: CsvRow[],
  updateAi: CsvRow[],
  locationIds: Set<string>
): string[] {
  const errors: string[] = [];

  for (const t of tasks) {
    const lid = (t.locationId ?? "").trim();
    if (!lid) {
      errors.push(`task ${t.id}: missing locationId`);
      continue;
    }
    if (!locationIds.has(lid)) {
      errors.push(`task ${t.id}: unknown locationId ${lid}`);
    }
    const leak = hasPmLeakage(t.location ?? "");
    if (leak) errors.push(`task ${t.id}: location text contains forbidden "${leak}"`);
  }

  for (const ai of updateAi) {
    const lid = (ai.locationId ?? "").trim();
    if (!lid) {
      errors.push(`update_ai ${ai.updateId}: missing locationId`);
      continue;
    }
    if (!locationIds.has(lid)) {
      errors.push(`update_ai ${ai.updateId}: unknown locationId ${lid}`);
    }
    const loc = ai.location ?? "";
    const leak = hasPmLeakage(loc);
    if (leak) {
      errors.push(`update_ai ${ai.updateId}: location text contains forbidden "${leak}"`);
    }
  }

  return errors;
}
