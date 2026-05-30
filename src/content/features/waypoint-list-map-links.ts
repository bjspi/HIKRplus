import { externalMapUrl } from "../../shared/external-map";
import { sendMessage } from "../../shared/messages";
import { parseHtml, parseWaypointDocument } from "../../shared/parser";
import type { WaypointCacheRecord } from "../../shared/types";
import { getWaypointId } from "../../shared/url";
import type { HikrFeature } from "../feature-types";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

async function loadWaypoint(url: string): Promise<WaypointCacheRecord | undefined> {
  const id = getWaypointId(url);
  try {
    const { waypoint } = await sendMessage<{ waypoint: WaypointCacheRecord | undefined }>({ type: "GET_CACHED_WAYPOINT", id });
    if (waypoint?.coordinates) return waypoint;
  } catch {}
  try {
    const { html } = await sendMessage<{ html: string }>({ type: "FETCH_HIKR_PAGE", url });
    const waypoint = parseWaypointDocument(parseHtml(html, url), url);
    if (waypoint.name || waypoint.coordinates) {
      await sendMessage({ type: "PUT_CACHED_WAYPOINT", waypoint }).catch(() => undefined);
    }
    return waypoint;
  } catch {
    return undefined;
  }
}

async function enrichWaypointList(list: HTMLDetailsElement, context: Parameters<HikrFeature["run"]>[0]): Promise<void> {
  if (!list.open || list.dataset.hikrMapLinks === "done" || list.dataset.hikrMapLinks === "loading") return;
  list.dataset.hikrMapLinks = "loading";
  const items = [...list.querySelectorAll<HTMLElement>("li[data-hikr-waypoint-url]")];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next++]!;
      const url = item.dataset.hikrWaypointUrl;
      const slot = item.querySelector<HTMLElement>(".hikr-ext-waypoint-map-slot");
      if (!url || !slot || slot.dataset.hikrReady) continue;
      slot.dataset.hikrReady = "loading";
      const waypoint = await loadWaypoint(url);
      if (!waypoint?.coordinates) {
        slot.dataset.hikrReady = "missing";
        continue;
      }
      const map = externalMapUrl(waypoint.coordinates, context.settings);
      slot.innerHTML = `<a class="hikr-ext-link hikr-ext-external-map-link hikr-ext-waypoint-map-link" href="${esc(map.href)}" target="_blank" rel="noopener noreferrer" title="In ${esc(map.label)} öffnen">↗</a>`;
      slot.dataset.hikrReady = "done";
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, () => worker()));
  list.dataset.hikrMapLinks = "done";
}

export const waypointListMapLinksFeature: HikrFeature = {
  id: "waypointListMapLinks",
  title: "Waypoint List Map Links",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0,
  run(context) {
    document.addEventListener("toggle", (event) => {
      const list = (event.target as HTMLElement | null)?.closest?.(".hikr-ext-waypoint-list");
      if (list instanceof HTMLDetailsElement) void enrichWaypointList(list, context);
    }, true);
    document.addEventListener("click", (event) => {
      const summary = (event.target as HTMLElement).closest<HTMLElement>(".hikr-ext-waypoint-list > summary");
      const list = summary?.parentElement;
      if (list instanceof HTMLDetailsElement) window.setTimeout(() => void enrichWaypointList(list, context), 0);
    });
  }
};
