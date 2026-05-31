import type { Coordinates, GeodataLink, TourCacheRecord, TourWaypointEntry, WaypointCacheRecord } from "./types";
import { TOUR_CACHE_VERSION } from "./types";
import { parseGalleryPhotoIds } from "./photo-annotations";
import { parseCoordinates, roundTo } from "./coordinates";
import { absoluteUrl, getTourId, getWaypointId, isWaypointUrl, normalizeHikrUrl } from "./url";

const FIELD_ALIASES = {
  dateOfHike: ["tour datum", "date of the hike", "date", "datum"],
  hikingGrade: ["wandern schwierigkeit", "hiking grading", "hiking grade"],
  climbingGrade: ["klettern schwierigkeit", "climbing grading", "climbing grade"],
  tourDuration: ["zeitbedarf", "time", "duration"],
  heightGain: ["aufstieg", "height gain", "ascent"],
  heightLoss: ["abstieg", "height loss", "descent"],
  routeLength: ["strecke", "route", "distance"],
  waypoints: ["wegpunkte", "waypoints"],
  coordinates: ["koordinaten", "coordinates"]
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/:$/, "").toLowerCase();
}

function findTableValue(documentRef: Document | Element, aliases: readonly string[]): string | undefined {
  const rows = [...documentRef.querySelectorAll("tr")];
  for (const row of rows) {
    const cells = [...row.querySelectorAll("td, th")];
    if (cells.length < 2) continue;
    const label = normalizeLabel(cells[0].textContent ?? "");
    if (aliases.some((alias) => label.includes(alias))) {
      const clone = cells[1].cloneNode(true) as HTMLElement;
      clone.querySelectorAll("span, script, style").forEach((element) => element.remove());
      return clone.textContent?.trim().replace(/\s+/g, " ") || undefined;
    }
  }
  return undefined;
}

function field(documentRef: Document | Element, key: FieldKey): string | undefined {
  return findTableValue(documentRef, FIELD_ALIASES[key]);
}

function findRowCell(documentRef: Document | Element, aliases: readonly string[]): Element | undefined {
  const rows = [...documentRef.querySelectorAll("tr")];
  for (const row of rows) {
    const cells = [...row.querySelectorAll("td, th")];
    if (cells.length < 2) continue;
    const label = normalizeLabel(cells[0].textContent ?? "");
    if (aliases.some((alias) => label.includes(alias))) return cells[1];
  }
  return undefined;
}

const WAYPOINT_ENTRY_RE = /^(.*?)\s+(\d{2,5})\s*m(?:\s*\(([\d.,]+)\))?\s*$/;

function parseWaypointEntries(documentRef: Document, baseUrl: string): TourWaypointEntry[] {
  const cell = findRowCell(documentRef, FIELD_ALIASES.waypoints);
  if (!cell) return [];
  const entries: TourWaypointEntry[] = [];
  for (const li of cell.querySelectorAll("li")) {
    const anchor = li.querySelector<HTMLAnchorElement>('a.standard[href*="/dir/"], a[href*="/dir/"]:not([href*="google.com"])');
    const rawText = anchor ? (anchor.textContent ?? "") : (li.textContent ?? "");
    const text = rawText.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const match = text.match(WAYPOINT_ENTRY_RE);
    const href = anchor?.getAttribute("href");
    const url = href && /\/dir\//.test(href) && !/google\.com/i.test(href)
      ? normalizeHikrUrl(absoluteUrl(href, baseUrl))
      : undefined;
    if (!match) {
      entries.push({ url, name: text });
      continue;
    }
    entries.push({
      url,
      name: match[1].trim(),
      elevation: Number(match[2]),
      visits: match[3] ? Number(match[3].replace(/[.,]/g, "")) : undefined
    });
  }
  return entries;
}

function parsePublisher(documentRef: Document): {
  publishedBy?: string;
  publishedByUrl?: string;
  publishedAt?: string;
} {
  const author = documentRef.querySelector<HTMLElement>("div.author");
  if (!author) return {};
  const clone = author.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".control, script, style").forEach((element) => element.remove());
  const text = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  const publishedAt = text.match(/(\d{1,2}\.\s*\S+\s*\d{4}\s*um\s*\d{1,2}:\d{2})/i)?.[1];
  const userAnchor = author.querySelector<HTMLAnchorElement>('a[href*="/user/"]');
  return {
    publishedBy: userAnchor?.textContent?.trim() ?? undefined,
    publishedByUrl: userAnchor ? new URL(userAnchor.href).href : undefined,
    publishedAt
  };
}

function parsePhotoCount(documentRef: Document): number | undefined {
  for (const anchor of documentRef.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
    const match = text.match(/Fotos der Tour\s*\((\d+)\)/i);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function geodataFormat(url: string, label: string): GeodataLink["format"] {
  const value = `${url} ${label}`.toLowerCase();
  if (value.includes(".gpx") || /\bgpx\b/.test(value)) return "gpx";
  if (value.includes(".kml") || /\bkml\b/.test(value)) return "kml";
  if (value.includes(".kmz") || /\bkmz\b/.test(value)) return "kmz";
  return "unknown";
}

function isRealGeodataLink(absolute: string, label: string): boolean {
  if (/google\.com\/maps/i.test(absolute)) return false;
  if (/\.(gpx|kml|kmz)(?:[?#].*)?$/i.test(absolute)) return true;
  if (/dl_geo\.php/i.test(absolute)) return true;
  if (/[?&](format|type)=(gpx|kml|kmz)\b/i.test(absolute)) return true;
  if (/^(gpx|kml|kmz|geodaten|geodata)$/i.test(label.trim())) return true;
  return false;
}

export function parseGeodataLinks(documentRef: Document, url: string): GeodataLink[] {
  const scope = documentRef.querySelector("table.fiche_rando") ?? documentRef;
  const links: GeodataLink[] = [];
  for (const anchor of scope.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    const label = (anchor.textContent ?? "").trim().replace(/\s+/g, " ") || "Geodaten";
    const absolute = absoluteUrl(href, url);
    if (!isRealGeodataLink(absolute, label)) continue;
    links.push({
      url: absolute,
      format: geodataFormat(absolute, label),
      label
    });
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = link.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseTourDocument(documentRef: Document, url: string): TourCacheRecord {
  const title =
    documentRef.querySelector("h1.title")?.textContent?.trim() ??
    documentRef.querySelector("h1")?.textContent?.trim() ??
    undefined;

  const waypointEntries = parseWaypointEntries(documentRef, url);
  const uniqueWaypointUrls = [...new Set(
    waypointEntries
      .map((entry) => entry.url)
      .filter((value): value is string => Boolean(value) && isWaypointUrl(value!))
  )];
  const firstNamed = waypointEntries.find((entry) => entry.name);
  const lastNamed = [...waypointEntries].reverse().find((entry) => entry.name);
  const elevations = waypointEntries.map((entry) => entry.elevation).filter((value): value is number => Number.isFinite(value));
  const maxElevation = elevations.length > 0 ? Math.max(...elevations) : undefined;
  const geodataLinks = parseGeodataLinks(documentRef, url);
  const publisher = parsePublisher(documentRef);

  const record: TourCacheRecord = {
    id: getTourId(url),
    url: normalizeHikrUrl(url),
    title,
    dateOfHike: field(documentRef, "dateOfHike"),
    hikingGrade: field(documentRef, "hikingGrade"),
    climbingGrade: field(documentRef, "climbingGrade"),
    tourDuration: field(documentRef, "tourDuration"),
    heightGain: field(documentRef, "heightGain"),
    heightLoss: field(documentRef, "heightLoss"),
    routeLength: field(documentRef, "routeLength"),
    waypointUrls: uniqueWaypointUrls,
    waypoints: waypointEntries,
    maxElevation,
    geodataLinks,
    startWaypointUrl: waypointEntries[0]?.url,
    startWaypointName: firstNamed?.name,
    endWaypointName: lastNamed?.name,
    publishedBy: publisher.publishedBy,
    publishedByUrl: publisher.publishedByUrl,
    publishedAt: publisher.publishedAt,
    galleryPhotoIds: parseGalleryPhotoIds(documentRef),
    photoCount: parsePhotoCount(documentRef),
    geodataCount: geodataLinks.length,
    cacheVersion: TOUR_CACHE_VERSION,
    parsedAt: Date.now(),
    missingFields: []
  };

  for (const key of ["title", "dateOfHike", "tourDuration", "heightGain", "routeLength"] as const) {
    if (!record[key]) record.missingFields.push(key);
  }
  if (record.waypointUrls.length === 0) record.missingFields.push("waypointUrls");
  return record;
}

export function parseWaypointDocument(documentRef: Document, url: string): WaypointCacheRecord {
  const coordinateText = field(documentRef, "coordinates") ?? documentRef.body.textContent ?? "";
  const coordinates = parseCoordinates(coordinateText);
  const name =
    documentRef.querySelector("h1.title")?.textContent?.trim() ??
    documentRef.querySelector("h1")?.textContent?.trim() ??
    undefined;

  return {
    id: getWaypointId(url),
    url: normalizeHikrUrl(url),
    name,
    coordinates,
    parsedAt: Date.now(),
    missingFields: [...(!name ? ["name"] : []), ...(!coordinates ? ["coordinates"] : [])]
  };
}

export function parseHtml(html: string, url: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export interface PizEntry {
  id: string;
  name?: string;
  coordinates: Coordinates;
  elevation?: number;
  type?: string;
}

// Single-tour pages embed every minimap waypoint as `pizs.push({...})` blocks in
// an inline script. Each carries piz_id (the numeric id that also ends the
// /dir/Name_ID/ waypoint URLs), name, height and exact coordinates — so we can
// harvest waypoint coordinates straight from the tour page instead of fetching
// each waypoint separately.
export function extractPizEntries(source: string): PizEntry[] {
  const entries: PizEntry[] = [];
  const chunks = source.split("pizs.push(");
  for (let i = 1; i < chunks.length; i++) {
    const end = chunks[i].indexOf("})");
    const block = end >= 0 ? chunks[i].slice(0, end) : chunks[i].slice(0, 800);
    const idMatch = block.match(/piz_id\s*:\s*(\d+)/);
    const latMatch = block.match(/piz_lat\s*:\s*(-?\d+(?:\.\d+)?)/);
    const lonMatch = block.match(/piz_lon\s*:\s*(-?\d+(?:\.\d+)?)/);
    if (!idMatch || !latMatch || !lonMatch) continue;
    const lat = Number(latMatch[1]);
    const lng = Number(lonMatch[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const nameMatch = block.match(/piz_name\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const heightMatch = block.match(/piz_height\s*:\s*(\d+)/);
    const typeMatch = block.match(/piz_type\s*:\s*"([^"]*)"/);
    entries.push({
      id: idMatch[1],
      name: nameMatch ? nameMatch[1].replace(/\\"/g, '"') : undefined,
      coordinates: { lat: roundTo(lat, 6), lng: roundTo(lng, 6) },
      elevation: heightMatch ? Number(heightMatch[1]) : undefined,
      type: typeMatch ? typeMatch[1] : undefined
    });
  }
  return entries;
}
