/**
 * Structured operational logs for pilot debugging (upload, transcription, AI, etc.).
 * Writes JSON lines to stdout for log aggregation.
 */

export type OpsLogLevel = "info" | "warn" | "error";

export function opsLog(
  level: OpsLogLevel,
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
