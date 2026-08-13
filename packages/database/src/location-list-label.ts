import type { CsvRow } from "./demo-seed/types.js";

/**
 * Compact location line for supervisor list cards (~max 3 segments, ~40 chars).
 * Vocabulary aligned with site language (Twr, L02, B2, etc.).
 */
export function deriveLocationListLabel(row: CsvRow): string {
  const l1 = (row.level1 ?? "").trim();
  const l2 = (row.level2 ?? "").trim();
  const l3 = (row.level3 ?? "").trim();
  const l4 = (row.level4 ?? "").trim();

  const building = abbrevBuilding(l1);
  const band = abbrevLevelOrBand(l2);
  const place = pickThirdChunk(l3, l4);

  const parts = [building, band, place].filter((p) => p.length > 0);
  const joined = parts.join(" · ");
  if (joined.length <= 40) return joined;
  return `${joined.slice(0, 37)}…`;
}

function abbrevBuilding(s: string): string {
  const m = /^Tower\s+([AB])$/i.exec(s);
  if (m) return `Twr ${m[1]}`;
  if (/^Office Tower$/i.test(s)) return "Off Twr";
  if (/^Podium$/i.test(s)) return "Podium";
  if (/^Clubhouse$/i.test(s)) return "Club Hs";
  if (/^Annex$/i.test(s)) return "Annex";
  if (/^Parking Structure$/i.test(s)) return "Park Str";
  if (/^Basement\s+B\d$/i.test(s)) return abbrevLevelOrBand(s);
  return s.length > 14 ? `${s.slice(0, 12)}…` : s;
}

function abbrevLevelOrBand(s: string): string {
  const lev = /^Level\s+(\d{1,2})$/i.exec(s);
  if (lev) return `L${lev[1].padStart(2, "0")}`;
  const bas = /^Basement\s+(B\d)$/i.exec(s);
  if (bas) return bas[1];
  if (/^Ground\s+Floor$/i.test(s)) return "GF";
  if (/^Roof\s+Plant$/i.test(s)) return "Roof Plt";
  if (/^Roof$/i.test(s)) return "Roof";
  return s.length > 12 ? `${s.slice(0, 10)}…` : s;
}

const FILLER_L3 =
  /^(East|West)\s+Core$|^(North|South)\s+Wing$|^Amenity\s+Deck$|^Central\s+Core$/i;

/** Zone-type level3 where we prefer the zone over a long room name in level4 (per list UX). */
const ZONE_L3 =
  /^Parking Bay|Loading Dock|Drop-off Lobby|Main Lobby|Service Yard|Service Corridor|MEP Corridor|Tenant Floor$/i;

function pickThirdChunk(l3: string, l4: string): string {
  const t3 = l3.trim();
  const t4 = l4.trim();

  if (t3 && ZONE_L3.test(t3)) {
    return shortenPlace(t3);
  }
  if (t4) {
    return shortenPlace(t4);
  }
  if (t3 && !FILLER_L3.test(t3)) {
    return shortenPlace(t3);
  }
  return t3 ? shortenPlace(t3) : "";
}

function shortenPlace(s: string): string {
  let t = s.replace(/\s+Area$/i, "");
  t = t.replace(/^Kids\s+Play$/i, "Kids Play");
  return t.length > 18 ? `${t.slice(0, 16)}…` : t;
}
