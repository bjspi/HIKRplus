import { getTourId, getWaypointId } from "../../shared/url";
import { sendMessage } from "../../shared/messages";
import { devLog, devWarn } from "../../shared/dev-log";
import { t } from "../../shared/i18n";
import { parseHtml, parseTourDocument, parseWaypointDocument } from "../../shared/parser";
import type { TourCacheRecord, WaypointCacheRecord } from "../../shared/types";
import { detailHtml, ensureTourPlaceholder, findTourContainer } from "../dom";
import type { HikrFeature } from "../feature-types";

function tourLooksParseable(tour: TourCacheRecord, html: string): boolean {
  if (tour.title) return true;
  if (tour.waypointUrls.length > 0) return true;
  if (tour.publishedBy) return true;
  if (tour.tourDuration || tour.heightGain || tour.routeLength) return true;
  return /class=["']?fiche_rando_b["']?|id=["']?fiche["']?/i.test(html);
}

function waypointLooksParseable(record: WaypointCacheRecord, html: string): boolean {
  if (record.name) return true;
  if (record.coordinates) return true;
  return /class=["']?fiche_rando/i.test(html);
}

async function loadOrFetchTour(url: string, force: boolean): Promise<TourCacheRecord | undefined> {
  const id = getTourId(url);
  if (!force) {
    try {
      const { tour } = await sendMessage<{ tour: TourCacheRecord | undefined }>({ type: "GET_CACHED_TOUR", id });
      if (tour) {
        devLog("enrich", "cache HIT tour", id, { missing: tour.missingFields });
        return tour;
      }
    } catch (error) {
      devWarn("enrich", "GET_CACHED_TOUR failed", id, error);
    }
  }
  let html: string;
  try {
    const response = await sendMessage<{ html: string }>({ type: "FETCH_HIKR_PAGE", url });
    html = response.html;
  } catch (error) {
    devWarn("enrich", "FETCH_HIKR_PAGE tour failed", url, error);
    return undefined;
  }
  let tour: TourCacheRecord;
  try {
    tour = parseTourDocument(parseHtml(html, url), url);
  } catch (error) {
    devWarn("enrich", "parseTourDocument threw", url, error);
    return undefined;
  }
  if (!tourLooksParseable(tour, html)) {
    devWarn("enrich", "tour not parseable, not caching", url, { missing: tour.missingFields });
    return tour;
  }
  devLog("enrich", "parsed tour", url, {
    title: tour.title,
    duration: tour.tourDuration,
    gain: tour.heightGain,
    loss: tour.heightLoss,
    length: tour.routeLength,
    maxElev: tour.maxElevation,
    waypoints: tour.waypoints.length,
    geodata: tour.geodataCount,
    missing: tour.missingFields
  });
  try {
    await sendMessage({ type: "PUT_CACHED_TOUR", tour });
  } catch (error) {
    devWarn("enrich", "PUT_CACHED_TOUR failed", url, error);
  }
  return tour;
}

async function loadOrFetchWaypoint(url: string, force: boolean): Promise<WaypointCacheRecord | undefined> {
  const id = getWaypointId(url);
  if (!force) {
    try {
      const { waypoint } = await sendMessage<{ waypoint: WaypointCacheRecord | undefined }>({ type: "GET_CACHED_WAYPOINT", id });
      if (waypoint) {
        devLog("enrich", "cache HIT waypoint", id);
        return waypoint;
      }
    } catch (error) {
      devWarn("enrich", "GET_CACHED_WAYPOINT failed", id, error);
    }
  }
  let html: string;
  try {
    const response = await sendMessage<{ html: string }>({ type: "FETCH_HIKR_PAGE", url });
    html = response.html;
  } catch (error) {
    devWarn("enrich", "FETCH_HIKR_PAGE waypoint failed", url, error);
    return undefined;
  }
  let waypoint: WaypointCacheRecord;
  try {
    waypoint = parseWaypointDocument(parseHtml(html, url), url);
  } catch (error) {
    devWarn("enrich", "parseWaypointDocument threw", url, error);
    return undefined;
  }
  if (!waypointLooksParseable(waypoint, html)) {
    devWarn("enrich", "waypoint not parseable, not caching", url);
    return waypoint;
  }
  try {
    await sendMessage({ type: "PUT_CACHED_WAYPOINT", waypoint });
  } catch (error) {
    devWarn("enrich", "PUT_CACHED_WAYPOINT failed", url, error);
  }
  return waypoint;
}

export function reserveTourPlaceholders(tourUrls: string[]): void {
  for (const url of tourUrls) {
    const parent = findTourContainer(url);
    if (parent) ensureTourPlaceholder(parent, url);
  }
}

function renderTourInto(tour: TourCacheRecord, waypoint: WaypointCacheRecord | undefined, waypointGmapsLinks: boolean): void {
  const parent = findTourContainer(tour.url);
  if (!parent) {
    devWarn("render", "no container for", tour.url);
    return;
  }
  const details = ensureTourPlaceholder(parent, tour.url);
  const inline = details.classList.contains("hikr-ext-tour-inline");
  details.innerHTML = detailHtml(tour, !inline && waypointGmapsLinks ? waypoint : undefined, currentSettings, inline);
  details.classList.remove("hikr-ext-tour-pending");
  details.dataset.tourId = tour.id;
  details.dataset.waypointId = tour.startWaypointUrl ? getWaypointId(tour.startWaypointUrl) : "";
  if (!inline && waypoint?.coordinates) {
    details.dataset.lat = String(waypoint.coordinates.lat);
    details.dataset.lng = String(waypoint.coordinates.lng);
  }
  devLog("render", "tour", tour.id, { withWaypoint: Boolean(waypoint), missing: tour.missingFields });
}

let currentSettings: import("../../shared/types").ExtensionSettings | undefined;

const ENRICH_CONCURRENCY = 4;

const enrichmentSeen = new Set<string>();
const enrichmentQueue: string[] = [];
let enrichmentActive = 0;
let enrichmentOptions: { waypointGmapsLinks: boolean; force: boolean } = { waypointGmapsLinks: true, force: false };

function pumpEnrichment(): void {
  while (enrichmentActive < ENRICH_CONCURRENCY && enrichmentQueue.length > 0) {
    const url = enrichmentQueue.shift();
    if (!url) return;
    enrichmentActive++;
    void enrichOne(url, enrichmentOptions.force, enrichmentOptions.waypointGmapsLinks).finally(() => {
      enrichmentActive--;
      pumpEnrichment();
    });
  }
}

export function enqueueTours(urls: string[], options?: { force?: boolean; waypointGmapsLinks?: boolean }): void {
  if (options?.force !== undefined) enrichmentOptions.force = options.force;
  if (options?.waypointGmapsLinks !== undefined) enrichmentOptions.waypointGmapsLinks = options.waypointGmapsLinks;
  let added = 0;
  for (const url of urls) {
    const norm = url.replace(/\/$/, "");
    if (enrichmentSeen.has(norm)) continue;
    enrichmentSeen.add(norm);
    enrichmentQueue.push(url);
    added++;
  }
  if (added > 0) devLog("enrich", "enqueued", { added, queueLength: enrichmentQueue.length });
  pumpEnrichment();
}

async function enrichOne(url: string, force: boolean, waypointGmapsLinks: boolean): Promise<{ tour?: TourCacheRecord; waypoint?: WaypointCacheRecord }> {
  const tour = await loadOrFetchTour(url, force);
  if (!tour) return {};
  try {
    renderTourInto(tour, undefined, waypointGmapsLinks);
  } catch (error) {
    devWarn("render", "first pass failed", url, error);
  }
  if (!tour.startWaypointUrl) return { tour };
  const waypoint = await loadOrFetchWaypoint(tour.startWaypointUrl, force);
  if (waypoint) {
    try {
      renderTourInto(tour, waypoint, waypointGmapsLinks);
    } catch (error) {
      devWarn("render", "second pass failed", url, error);
    }
  }
  return { tour, waypoint };
}

export async function enrichVisibleTours(tourUrls: string[], force = false, options = { waypointGmapsLinks: true }, concurrency = ENRICH_CONCURRENCY): Promise<{
  tours: TourCacheRecord[];
  waypoints: WaypointCacheRecord[];
}> {
  const c = Math.max(1, concurrency);
  devLog("enrich", "start (one-shot)", { count: tourUrls.length, force, concurrency: c });
  const tours: TourCacheRecord[] = [];
  const waypoints: WaypointCacheRecord[] = [];
  const queue = [...tourUrls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) return;
      const result = await enrichOne(url, force, options.waypointGmapsLinks);
      if (result.tour) tours.push(result.tour);
      if (result.waypoint) waypoints.push(result.waypoint);
    }
  }
  await Promise.all(Array.from({ length: Math.min(c, tourUrls.length) }, () => worker()));
  devLog("enrich", "done (one-shot)", { tours: tours.length, waypoints: waypoints.length });
  return { tours, waypoints };
}

function autoloadAllowed(pageType: string, settings: { tourDetailsAutoload: Record<string, boolean> }): boolean {
  if (pageType === "tour") return false;
  const key = pageType in settings.tourDetailsAutoload ? pageType : undefined;
  return key ? Boolean(settings.tourDetailsAutoload[key]) : false;
}

export const tourDetailsFeature: HikrFeature = {
  id: "tourDetailsEnrichment",
  title: "Tour Details Enrichment",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0,
  run({ page, settings, log }) {
    currentSettings = settings;
    if (document.body.dataset.hikrExtToursEnriched) return;
    if (!autoloadAllowed(page.pageType, settings)) {
      log(t("autoload_off_for", { page: page.pageType }));
      return;
    }
    document.body.dataset.hikrExtToursEnriched = "true";
    reserveTourPlaceholders(page.tourUrls);
    enqueueTours(page.tourUrls, { force: false, waypointGmapsLinks: settings.ui.waypointGmapsLinks });
    log(t("tourdetails_loaded", { loaded: 0, total: page.tourUrls.length }));
    document.addEventListener("hikr:ext:tours-appended", (event) => {
      const detail = (event as CustomEvent<{ tourUrls: string[] }>).detail;
      if (!detail?.tourUrls?.length) return;
      reserveTourPlaceholders(detail.tourUrls);
      enqueueTours(detail.tourUrls, { force: false, waypointGmapsLinks: settings.ui.waypointGmapsLinks });
    });
  }
};
