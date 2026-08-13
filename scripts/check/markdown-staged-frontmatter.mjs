#!/usr/bin/env node
/**
 * Validates YAML frontmatter on staged Markdown under configured paths.
 * Requires `last_changes` (non-empty string) and `last_updated` (ISO-8601 timestamp).
 * For pre-commit, `last_updated` must be within maxAgeMs of now (default 2 hours).
 *
 * Config: scripts/check/markdown-frontmatter.json
 *
 * Usage:
 *   node scripts/check/markdown-staged-frontmatter.mjs --staged   # default; staged files only
 *   node scripts/check/markdown-staged-frontmatter.mjs -- path1.md path2.md
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const CONFIG_PATH = join(__dirname, "markdown-frontmatter.json");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`markdown-staged-frontmatter: missing config ${relative(REPO_ROOT, CONFIG_PATH)}`);
    process.exit(1);
  }
  const raw = readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function getStagedPaths() {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function pathMatchesScope(relPath, cfg, explicitPaths) {
  if (!relPath.endsWith(".md")) return false;
  if (cfg.excludePaths?.includes(relPath)) return false;
  if (explicitPaths) return true;
  const prefixes = cfg.includePrefixes ?? [];
  return prefixes.some((p) => relPath.startsWith(p));
}

/**
 * @param {string} text
 * @returns {{ raw: string, map: Record<string, string> } | null}
 */
function parseFrontmatterBlock(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return null;
  const fmLines = lines.slice(1, end);
  const map = {};
  for (const line of fmLines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf(":");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  const raw = fmLines.join("\n");
  return { raw, map };
}

function main() {
  const cfg = loadConfig();
  if (!cfg.enabled) {
    process.exit(0);
  }

  const args = process.argv.slice(2);
  let paths = [];
  let explicitPaths = false;
  if (args[0] === "--") {
    explicitPaths = true;
    paths = args.slice(1).filter(Boolean);
  } else if (args.includes("--staged") || args.length === 0) {
    const staged = getStagedPaths();
    if (staged === null) {
      console.warn("markdown-staged-frontmatter: not a git repo or git failed; skipping");
      process.exit(0);
    }
    paths = staged;
  } else {
    console.error("Usage: markdown-staged-frontmatter.mjs [--staged] | [-- file1.md ...]");
    process.exit(2);
  }

  const maxAge = typeof cfg.maxAgeMs === "number" ? cfg.maxAgeMs : 7200000;
  const futureSkew = typeof cfg.futureSkewMs === "number" ? cfg.futureSkewMs : 300000;
  const now = Date.now();

  const errors = [];
  for (const relArg of paths) {
    const abs = explicitPaths ? resolve(REPO_ROOT, relArg) : join(REPO_ROOT, relArg);
    const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
    if (rel.startsWith("..")) {
      errors.push(`${relArg}: path must be inside the repository`);
      continue;
    }
    if (!pathMatchesScope(rel, cfg, explicitPaths)) continue;
    if (!existsSync(abs)) continue;
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      errors.push(`${rel}: could not read file`);
      continue;
    }
    const fm = parseFrontmatterBlock(text);
    if (!fm) {
      errors.push(
        `${rel}: missing or invalid YAML frontmatter (file must start with --- and close with a second --- before body)`,
      );
      continue;
    }
    const { map } = fm;
    const lc = map.last_changes;
    if (typeof lc !== "string" || lc.trim().length === 0) {
      errors.push(`${rel}: frontmatter must include last_changes (non-empty string)`);
    }
    const luRaw = map.last_updated;
    if (typeof luRaw !== "string" || luRaw.trim().length === 0) {
      errors.push(`${rel}: frontmatter must include last_updated (ISO-8601 timestamp)`);
      continue;
    }
    const ts = Date.parse(luRaw.trim());
    if (Number.isNaN(ts)) {
      errors.push(`${rel}: last_updated must be a parseable ISO-8601 timestamp (got: ${luRaw})`);
      continue;
    }
    if (ts > now + futureSkew) {
      errors.push(
        `${rel}: last_updated is too far in the future (check system clock; allowed skew ${futureSkew}ms)`,
      );
    }
    const age = now - ts;
    if (age > maxAge) {
      const hours = (maxAge / 3600000).toFixed(2);
      errors.push(
        `${rel}: last_updated is older than ${hours}h; refresh last_updated and last_changes before commit`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("Markdown frontmatter check failed:\n");
    for (const e of errors) console.error(`  - ${e}`);
    console.error(
      "\nRequired frontmatter shape:\n---\nlast_changes: \"Short description of this edit\"\nlast_updated: \"2026-03-27T12:00:00Z\"\n---\n",
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
