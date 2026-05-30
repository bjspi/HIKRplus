import { externalMapUrl } from "../../shared/external-map";
import { sendMessage } from "../../shared/messages";
import { parseHtml, parseWaypointDocument } from "../../shared/parser";
import type { ExtensionSettings, WaypointCacheRecord } from "../../shared/types";
import { getWaypointId, isWaypointUrl, normalizeHikrUrl } from "../../shared/url";
import type { HikrFeature } from "../feature-types";

export async function loadWaypoint(url: string): Promise<WaypointCacheRecord | undefined> {
  const id = getWaypointId(url);
  try {
    const { waypoint } = await sendMessage<{ waypoint: WaypointCacheRecord | undefined }>({ type: "GET_CACHED_WAYPOINT", id });
    if (waypoint) return waypoint;
  } catch {}
  try {
    const { html } = await sendMessage<{ html: string }>({ type: "FETCH_HIKR_PAGE", url });
    const record = parseWaypointDocument(parseHtml(html, url), url);
    if (record.name || record.coordinates) {
      await sendMessage({ type: "PUT_CACHED_WAYPOINT", waypoint: record }).catch(() => undefined);
    }
    return record;
  } catch {
    return undefined;
  }
}

function appendLink(doc: Document, anchor: HTMLAnchorElement, href: string, title: string): void {
  if (anchor.nextElementSibling?.classList.contains("hikr-ext-gmaps-link")) return;
  const link = doc.createElement("a");
  link.className = "hikr-ext-gmaps-link hikr-ext-external-map-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = title;
  link.innerHTML = '<span aria-hidden="true">↗</span>';
  anchor.insertAdjacentElement("afterend", link);
}

export async function annotateWaypointAnchors(root: Document | Element, settings: ExtensionSettings): Promise<number> {
  const doc = (root as Document).documentElement ? (root as Document) : ((root as Element).ownerDocument ?? document);
  const anchors = [...root.querySelectorAll<HTMLAnchorElement>('a[href*="/dir/"]')];
  const uniqueUrls = [...new Set(anchors.map((anchor) => normalizeHikrUrl(anchor.href)).filter(isWaypointUrl))];
  if (uniqueUrls.length === 0) return 0;
  const waypoints = new Map<string, WaypointCacheRecord>();
  for (const url of uniqueUrls) {
    const waypoint = await loadWaypoint(url);
    if (waypoint) waypoints.set(normalizeHikrUrl(url), waypoint);
  }
  let added = 0;
  for (const anchor of anchors) {
    const waypoint = waypoints.get(normalizeHikrUrl(anchor.href));
    if (!waypoint?.coordinates) continue;
    const map = externalMapUrl(waypoint.coordinates, settings);
    if (anchor.nextElementSibling?.classList.contains("hikr-ext-gmaps-link")) continue;
    appendLink(doc, anchor, map.href, `In ${map.label} öffnen`);
    added++;
  }
  return added;
}

export const waypointGmapsLinksFeature: HikrFeature = {
  id: "siteStyles",
  title: "Waypoint GMaps Links",
  defaultEnabled: true,
  matchesPage: (context) => context.waypointUrls.length > 0,
  async run({ settings }) {
    if (!settings.ui.waypointGmapsLinks) return;
    await annotateWaypointAnchors(document, settings);
  }
};
