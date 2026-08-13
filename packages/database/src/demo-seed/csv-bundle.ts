import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../parse-csv.js";
import { resolveDatasetDir } from "./config.js";
import { applyCurrentGeneratedOverlay } from "./generated-content.js";
import {
  BUNDLE_FILE_NAMES,
  type BundleFileKey,
  type DemoBundleRows,
  type LoadedDemoBundle,
} from "./types.js";

async function readCsvFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf8");
  return parseCsv(content);
}

export async function loadDemoBundle(
  repoRoot: string,
  contractId: string,
  options?: {
    includeGeneratedOverlay?: boolean;
  }
): Promise<LoadedDemoBundle> {
  const { datasetKey, dir } = await resolveDatasetDir(repoRoot, contractId);
  const rows = {} as DemoBundleRows;

  for (const [key, fileName] of Object.entries(
    BUNDLE_FILE_NAMES
  ) as Array<[BundleFileKey, string]>) {
    rows[key] = await readCsvFile(path.join(dir, fileName));
  }

  const sharedDir = path.join(repoRoot, "docs", "demo", "datasets", "shared");
  rows.departments = await readCsvFile(path.join(sharedDir, "departments.csv"));
  rows.roleTypes = await readCsvFile(path.join(sharedDir, "role_types.csv"));

  if (options?.includeGeneratedOverlay !== false) {
    await applyCurrentGeneratedOverlay(dir, rows);
  }

  return {
    contractId,
    datasetKey,
    dir,
    rows,
  };
}
