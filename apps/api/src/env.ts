import { existsSync } from "node:fs";

/**
 * AI Gateway URL for transcription and extraction services.
 * Default: http://localhost:4000
 */
export const AI_GATEWAY_URL =
  process.env.AI_GATEWAY_URL || "http://localhost:4000";

/**
 * When `1`, the API process runs a periodic outbox worker (`processOutboxBatch`) for
 * in-app notification delivery (§17). Default: off (explicit opt-in for demos/ops).
 */
export const OUTBOX_WORKER_ENABLED =
  process.env.OUTBOX_WORKER_ENABLED === "1";

/**
 * API authentication token for pilot/internal use.
 * Set V2E_API_TOKEN in production; defaults to 'dev-token' for local development.
 *
 * Clients must send: Authorization: Bearer <token>
 */
export const V2E_API_TOKEN = process.env.V2E_API_TOKEN || "dev-token";

/**
 * Authenticated demo user resolved by the pilot Bearer middleware.
 * Defaults to the shared seeded supervisor identity.
 */
export const V2E_API_USER_ID =
  process.env.V2E_API_USER_ID || "bcea1e0f-b972-4f75-8563-c9f64aa9756f";

/**
 * Public origin of this API (scheme + host + port) for server-side fetches to `/uploads/*`.
 * Transcription reads audio via HTTP; relative paths must be absolute. Default matches local dev.
 */
export const API_PUBLIC_URL =
  process.env.API_PUBLIC_URL?.replace(/\/$/, "") || "http://localhost:3000";

/** Below this confidence (0–1), extraction requires explicit human review before task creation. */
export const LOW_CONFIDENCE_THRESHOLD = Number.parseFloat(
  process.env.V2E_LOW_CONFIDENCE_THRESHOLD ?? "0.65"
);

/** At or above: auto-extraction may clear supervisor review after creating a task (hybrid high band). */
export const HIGH_CONFIDENCE_THRESHOLD = Number.parseFloat(
  process.env.V2E_HIGH_CONFIDENCE_THRESHOLD ?? "0.85"
);

/**
 * Allowed browser origins for CORS (comma-separated).
 * Defaults to local Vite dev servers plus Capacitor's native WebView origin.
 */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    "capacitor://localhost",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SQLite file path for the demo database.
 * - `SQLITE_PATH` or `DATABASE_PATH`: absolute or cwd-relative path to the `.sqlite` file
 * - `DATABASE_URL`: `file:/absolute/path/to/demo.sqlite` (SQLite URI style)
 * Default: monorepo `packages/database/data/demo.sqlite` (run `pnpm --filter @v2e/database db:seed` first).
 */
export function resolveSqlitePath(): string {
  const fileUrl = process.env.DATABASE_URL;
  const explicit = process.env.SQLITE_PATH ?? process.env.DATABASE_PATH;

  if (fileUrl?.startsWith("file:")) {
    return fileURLToPath(fileUrl);
  }
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.resolve(__dirname, "../../../packages/database/data/demo.sqlite");
}

export function sqliteFileExists(): boolean {
  try {
    return existsSync(resolveSqlitePath());
  } catch {
    return false;
  }
}
