#!/usr/bin/env node
/**
 * Ensures docs/AGENTS.md still defines the AGENTS.md content contract (required headings).
 * Pre-commit: pnpm check:agents-md-contract
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const doc = path.join(root, "docs", "AGENTS.md");

let text;
try {
  text = fs.readFileSync(doc, "utf8");
} catch {
  console.error("check-agents-md-contract: missing docs/AGENTS.md");
  process.exit(1);
}

const required = [
  "## What belongs in AGENTS.md",
  "## What usually does not belong in AGENTS.md",
];

for (const h of required) {
  if (!text.includes(h)) {
    console.error(
      `check-agents-md-contract: docs/AGENTS.md must include heading ${JSON.stringify(h)}`,
    );
    process.exit(1);
  }
}

process.exit(0);
