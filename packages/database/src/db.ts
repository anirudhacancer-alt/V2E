import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type DemoDb = ReturnType<typeof openDemoDb>;

/** Opens (creates) a SQLite file and returns a Drizzle client with the demo schema. */
export function openDemoDb(filePath: string) {
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}
