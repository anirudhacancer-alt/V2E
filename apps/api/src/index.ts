import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { getCorsOrigins, OUTBOX_WORKER_ENABLED, sqliteFileExists } from "./env.js";
import { getDemoDb } from "./db.js";
import { v1 } from "./routes/v1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const app = new Hono();

/** Demo: serve files written to apps/api/uploads (audio + photos). */
app.get("/uploads/*", async (c) => {
  const url = new URL(c.req.url);
  const rel = url.pathname.replace(/^\/uploads\/?/, "");
  if (!rel || rel.includes("..")) {
    return c.notFound();
  }
  const fp = path.join(UPLOADS_DIR, rel);
  if (!fp.startsWith(UPLOADS_DIR) || !existsSync(fp)) {
    return c.notFound();
  }
  const buf = readFileSync(fp);
  const ext = path.extname(rel).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webm"
              ? "audio/webm"
              : ext === ".mp3"
                ? "audio/mpeg"
                : ext === ".wav"
                  ? "audio/wav"
                  : "application/octet-stream";
  return c.body(buf, 200, { "Content-Type": contentType });
});

app.use(
  "*",
  cors({
    origin: getCorsOrigins(),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

app.get("/", (c) =>
  c.json({
    message: "V2E API - Voice to Execution",
    demo: true,
    auth: "none",
    hint: "Demo platform: no authentication. Versioned routes under /v1.",
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    demo: true,
  })
);

app.route("/v1", v1);

if (OUTBOX_WORKER_ENABLED) {
  const intervalMs = Number(process.env.OUTBOX_WORKER_INTERVAL_MS) || 5_000;
  void import("./lib/outbox.js").then(({ processOutboxBatch }) => {
    const tick = () => {
      try {
        if (!sqliteFileExists()) return;
        void processOutboxBatch(getDemoDb());
      } catch (e) {
        console.error("outbox worker tick failed", e);
      }
    };
    setInterval(tick, intervalMs);
    tick();
  });
}

const port = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`v2e-api listening on http://localhost:${info.port}`);
  }
);
