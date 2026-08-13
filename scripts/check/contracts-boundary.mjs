#!/usr/bin/env node
/**
 * Ensures apps and shared packages do not export TypeScript type/interface names
 * that are reserved for @v2e/contracts (derived from packages/contracts/src).
 *
 * Excludes: packages/contracts, packages/database, packages/ai (see REPO-INVARIANTS.md).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

const SCAN_ROOTS = [
  join(REPO_ROOT, "apps"),
  join(REPO_ROOT, "packages", "shared", "src"),
];

const EXCLUDE_DIR_NAMES = new Set(["node_modules", "dist", ".turbo"]);

const EXCLUDE_FILE_RE =
  /\.(?:gen|test)\.tsx?$|routeTree\.gen\.ts$|vite-env\.d\.ts$/;

/** Lines ignored (full-line // comments only; keep script simple). */
function stripComments(line) {
  const t = line.trim();
  if (t.startsWith("//")) return "";
  return line;
}

function loadReservedNames() {
  const dir = join(REPO_ROOT, "packages", "contracts", "src");
  const names = new Set();
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith(".ts")) continue;
    const text = readFileSync(join(dir, ent.name), "utf8");
    for (const line of text.split("\n")) {
      const L = stripComments(line);
      if (!L) continue;
      let m = /^\s*export\s+type\s+(\w+)/.exec(L);
      if (m) names.add(m[1]);
      m = /^\s*export\s+interface\s+(\w+)/.exec(L);
      if (m) names.add(m[1]);
    }
  }
  return names;
}

const EXPORT_TYPE_OR_INTERFACE =
  /^\s*export\s+(?:declare\s+)?(?:type|interface)\s+(\w+)/;

function scanFile(reserved, filePath, relPath, violations) {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const L = stripComments(line);
    if (!L) continue;
    if (/^\s*export\s+type\s*\{/.test(L)) continue;
    const m = EXPORT_TYPE_OR_INTERFACE.exec(L);
    if (!m) continue;
    const name = m[1];
    if (reserved.has(name)) {
      violations.push({ relPath, line: L.trim(), name });
    }
  }
}

function walk(dir, callback) {
  let st;
  try {
    st = statSync(dir);
  } catch {
    return;
  }
  if (!st.isDirectory()) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(ent.name)) continue;
      walk(p, callback);
    } else if (ent.isFile() && /\.tsx?$/.test(ent.name)) {
      callback(p);
    }
  }
}

function main() {
  const reserved = loadReservedNames();
  const violations = [];

  for (const root of SCAN_ROOTS) {
    walk(root, (filePath) => {
      const rel = relative(REPO_ROOT, filePath);
      if (EXCLUDE_FILE_RE.test(filePath)) return;
      scanFile(reserved, filePath, rel, violations);
    });
  }

  if (violations.length > 0) {
    console.error(
      "contracts-boundary: exported type/interface names conflict with @v2e/contracts.\n" +
        "Use types from @v2e/contracts or rename (see docs/architecture/REPO-INVARIANTS.md).\n",
    );
    for (const v of violations) {
      console.error(`  ${v.relPath}: ${v.name}\n    ${v.line}`);
    }
    process.exit(1);
  }

  console.log(
    `contracts-boundary: OK (${reserved.size} reserved names from packages/contracts).`,
  );
}

main();
