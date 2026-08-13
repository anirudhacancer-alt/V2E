/**
 * Resolve API-relative media paths (e.g. `/uploads/...`) for <img> / <audio> src.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  const base = (import.meta.env.VITE_API_URL as string | undefined) || "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      if (url.hostname === "demo.local") {
        return undefined;
      }
      return path;
    } catch {
      return path;
    }
  }
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    buffer[index] = bytes.charCodeAt(index);
  }
  return new Blob([buffer], { type: mimeType });
}

function responseDataToBlob(data: unknown, mimeType: string) {
  if (data instanceof Blob) {
    return data;
  }
  if (typeof data === "string") {
    const base64 = data.includes(",") ? data.split(",", 2)[1] ?? "" : data;
    return base64ToBlob(base64, mimeType);
  }
  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: mimeType });
  }
  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return new Blob(
      [bytes.buffer],
      { type: mimeType },
    );
  }
  if (Array.isArray(data)) {
    return new Blob([new Uint8Array(data)], { type: mimeType });
  }
  throw new Error("Unsupported media response payload");
}

export async function resolveNativeMediaObjectUrl(
  path: string | null | undefined,
): Promise<string | undefined> {
  const resolved = resolveMediaUrl(path);
  if (!resolved) return undefined;
  if (!Capacitor.isNativePlatform()) return resolved;

  const response = await CapacitorHttp.request({
    url: resolved,
    method: "GET",
    responseType: "blob",
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });
  const mimeType =
    response.headers["content-type"] ||
    response.headers["Content-Type"] ||
    "application/octet-stream";
  return URL.createObjectURL(responseDataToBlob(response.data, mimeType));
}
