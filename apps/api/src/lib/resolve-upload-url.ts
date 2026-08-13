import { API_PUBLIC_URL } from "../env.js";

/**
 * Turn a stored `audioUrl` (often `/uploads/...`) into an absolute URL the Node fetch stack can use.
 */
export function resolveAbsoluteAudioUrlForFetch(audioUrl: string | null | undefined): string | null {
  if (!audioUrl?.trim()) return null;
  const u = audioUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = API_PUBLIC_URL.replace(/\/$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}
