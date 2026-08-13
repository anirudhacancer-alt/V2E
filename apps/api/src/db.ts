import { statSync } from "node:fs";
import { openDemoDb, type DemoDb } from "@v2e/database";

import { resolveSqlitePath } from "./env.js";

type CachedDbState = {
  db: DemoDb;
  path: string;
  mtimeMs: number;
  size: number;
};

let cached: CachedDbState | null = null;

function readFileState(filePath: string) {
  const stats = statSync(filePath);
  return {
    path: filePath,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  };
}

/** Returns a singleton Drizzle client for the demo SQLite file. */
export function getDemoDb(): DemoDb {
  const filePath = resolveSqlitePath();
  const nextState = readFileState(filePath);

  if (
    !cached ||
    cached.path !== nextState.path ||
    cached.mtimeMs !== nextState.mtimeMs ||
    cached.size !== nextState.size
  ) {
    cached?.db.$client.close();
    cached = {
      db: openDemoDb(filePath),
      ...nextState,
    };
  }

  return cached.db;
}
