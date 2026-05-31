import { sendMessage } from "../../shared/messages";
import { extractPizEntries } from "../../shared/parser";
import { getWaypointId, normalizeHikrUrl } from "../../shared/url";
import type { WaypointCacheRecord } from "../../shared/types";
import { devLog, devWarn } from "../../shared/dev-log";
import type { HikrFeature } from "../feature-types";

// Collect inline scripts that carry the minimap's `pizs.push({...})` waypoint data.
function collectPizSource(): string {
  let source = "";
  for (const script of document.querySelectorAll("script:not([src])")) {
    const text = script.textContent;
    if (text && text.includes("pizs.push(")) source += text + "\n";
  }
  return source;
}

function slugUrl(name: string | undefined, id: string): string {
  const slug = (name ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return `https://www.hikr.org/dir/${slug ? slug + "_" : ""}${id}`;
}

export function buildPizWaypointRecords(source: string, waypointUrls: string[]): WaypointCacheRecord[] {
  const entries = extractPizEntries(source);
  if (entries.length === 0) return [];
  // Prefer the exact /dir/ URL from the page's anchors (keyed by the numeric id);
  // fall back to a synthesized slug URL for waypoints without an anchor.
  const urlById = new Map<string, string>();
  for (const url of waypointUrls) {
    const numeric = getWaypointId(url);
    if (numeric) urlById.set(numeric, normalizeHikrUrl(url));
  }
  // Round trips list waypoints twice (out and back) → dedupe by id.
  const byId = new Map<string, WaypointCacheRecord>();
  for (const piz of entries) {
    if (byId.has(piz.id)) continue;
    byId.set(piz.id, {
      id: piz.id,
      url: urlById.get(piz.id) ?? slugUrl(piz.name, piz.id),
      name: piz.name,
      coordinates: piz.coordinates,
      elevation: piz.elevation,
      parsedAt: Date.now(),
      missingFields: piz.name ? [] : ["name"]
    });
  }
  return [...byId.values()];
}

// Harvest waypoint coordinates/elevations from a tour's embedded `pizs` and store
// them in the waypoint cache. Works both on a live single-tour page and on tour
// HTML fetched while enriching a listing overlay.
export async function harvestPizWaypoints(source: string, waypointUrls: string[], label: string): Promise<number> {
  const records = buildPizWaypointRecords(source, waypointUrls);
  if (records.length === 0) return 0;
  let stored = 0;
  await Promise.all(records.map((record) =>
    sendMessage({ type: "PUT_CACHED_WAYPOINT", waypoint: record })
      .then(() => { stored++; })
      .catch((error) => devWarn("piz", "PUT_CACHED_WAYPOINT failed", record.id, error))
  ));
  devLog(
    "piz",
    `${stored} Wegpunkt(e) aus pizs gecached — ${label}`,
    records.map((r) => `#${r.id} ${r.name ?? "?"}${r.elevation != null ? ` ${r.elevation}m` : ""} → ${r.coordinates?.lat},${r.coordinates?.lng}`)
  );
  return stored;
}

export const waypointPizHarvestFeature: HikrFeature = {
  // Reuses the tour-details enrichment toggle — no separate setting required.
  id: "tourDetailsEnrichment",
  title: "Waypoint Coordinate Harvest",
  defaultEnabled: true,
  matchesPage: (context) => context.pageType === "tour",
  async run(context) {
    await harvestPizWaypoints(collectPizSource(), context.page.waypointUrls, "Einzeltour (Live)");
  }
};
