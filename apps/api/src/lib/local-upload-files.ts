import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

export function localUploadPathFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith("/uploads/")) return null;
  const rel = url.replace(/^\/uploads\/?/, "");
  if (!rel || rel.includes("..")) return null;
  const fp = path.join(UPLOADS_DIR, rel);
  if (!fp.startsWith(UPLOADS_DIR)) return null;
  return fp;
}

export function localUploadExists(url: string | null | undefined): boolean {
  const fp = localUploadPathFromUrl(url);
  return fp ? existsSync(fp) : false;
}
