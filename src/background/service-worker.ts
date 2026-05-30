import { cache } from "../shared/cache";
import { toursToExcel } from "../shared/excel";
import { devLog, devWarn, setDevLogging } from "../shared/dev-log";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { buildPhotoPageUrl, parsePhotoAnnotations } from "../shared/photo-annotations";
import { routeCacheId, routeCacheIsFresh, toRouteCacheRecord, toRouteFailureCacheRecord } from "../shared/route-cache";
import { isUnroutableRouteErrorMessage, routeProviders } from "../shared/route-providers";
import { loadSettings, patchSettings, saveSettings } from "../shared/settings";
import type { GeocodeResult, PhotoAnnotationCache, RouteCacheEntry, RouteRequest } from "../shared/types";
import { TOUR_CACHE_VERSION } from "../shared/types";

async function syncDevLogging(): Promise<void> {
  try {
    const settings = await loadSettings();
    setDevLogging(Boolean(settings.dev?.consoleLogging));
  } catch (error) {
    console.warn("HIKR settings load failed", error);
  }
}
void syncDevLogging();
chrome.storage.onChanged.addListener(() => void syncDevLogging());

async function migrateWaypointCache(): Promise<void> {
  try {
    const waypoints = await cache.getAllWaypoints();
    const dirty = waypoints.filter((wp) => "rawCoordinateText" in (wp as object));
    if (dirty.length === 0) return;
    await Promise.all(dirty.map((wp) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean = { ...wp } as any;
      delete clean.rawCoordinateText;
      return cache.putWaypoint(clean);
    }));
    devLog("migration", `removed rawCoordinateText from ${dirty.length} waypoints`);
  } catch (error) {
    console.warn("HIKR waypoint cache migration failed", error);
  }
}
void migrateWaypointCache();

async function fetchText(url: string): Promise<string> {
  devLog("fetch", "GET", url);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    devWarn("fetch", "non-OK", response.status, url);
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  const text = await response.text();
  devLog("fetch", "ok", url, `${text.length} bytes`);
  return text;
}

function downloadExcel(bytes: Uint8Array, filename: string): Promise<void> {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${btoa(binary)}`;
  return chrome.downloads.download({ url: dataUrl, filename, saveAs: false }).then(() => undefined);
}

const routeInFlight = new Map<string, Promise<RouteCacheEntry>>();
let routeCooldownQueue = Promise.resolve();
let routeBucketUpdatedAt = 0;
let routeTokens = 0;
let lastGeocodeFetchAt = 0;
let geocodeCooldownQueue = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRouteCooldown(settings: Awaited<ReturnType<typeof loadSettings>>): Promise<void> {
  const perMinute = Math.max(1, Number(settings.provider.orsRateLimitPerMinute) || 40);
  routeCooldownQueue = routeCooldownQueue.catch(() => undefined).then(async () => {
    const refillMs = 60_000 / perMinute;
    const capacity = Math.min(8, Math.max(2, Math.ceil(perMinute / 10)));
    const now = Date.now();
    if (!routeBucketUpdatedAt) {
      routeBucketUpdatedAt = now;
      routeTokens = capacity;
    }
    const refill = Math.floor((now - routeBucketUpdatedAt) / refillMs);
    if (refill > 0) {
      routeTokens = Math.min(capacity, routeTokens + refill);
      routeBucketUpdatedAt += refill * refillMs;
    }
    if (routeTokens < 1) {
      const waitMs = Math.max(0, Math.ceil(refillMs - (Date.now() - routeBucketUpdatedAt)));
      devLog("route", "rate wait", { waitMs, perMinute, refillMs, capacity, tokens: routeTokens });
      if (waitMs > 0) await sleep(waitMs);
      routeBucketUpdatedAt = Date.now();
      routeTokens = 1;
    }
    routeTokens--;
    devLog("route", "rate token", { perMinute, capacity, tokensLeft: routeTokens });
  });
  await routeCooldownQueue;
}

function normalizeGeocodeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function geocodeStorageKey(query: string): string {
  return `hikr.geocode.photon.${normalizeGeocodeQuery(query)}`;
}

function routeResponseFromEntry(entry: RouteCacheEntry): MessageResponse {
  if (entry.routeStatus === "unroutable") return { routeFailure: entry };
  return { route: entry };
}

interface RouteSnapRadiusHint {
  targetRadius: number;
  fetchedAt: number;
  expiresAt: number;
}

function routeSnapRadiusHintKey(request: RouteRequest): string {
  const target = `${request.target.lat.toFixed(5)},${request.target.lng.toFixed(5)}`;
  return ["hikr.route.snapRadius", request.provider, request.mode, target].join(".");
}

async function getRouteSnapRadiusHint(request: RouteRequest): Promise<RouteSnapRadiusHint | undefined> {
  if (request.provider !== "ors") return undefined;
  const key = routeSnapRadiusHintKey(request);
  const hint = (await chrome.storage.local.get(key))[key] as RouteSnapRadiusHint | undefined;
  if (!hint?.expiresAt || hint.expiresAt <= Date.now()) return undefined;
  return hint;
}

async function rememberRouteSnapRadiusHint(request: RouteRequest, settings: Awaited<ReturnType<typeof loadSettings>>, radius?: number): Promise<void> {
  if (request.provider !== "ors" || !radius || radius <= 5000) return;
  const fetchedAt = Date.now();
  const hint: RouteSnapRadiusHint = {
    targetRadius: radius,
    fetchedAt,
    expiresAt: fetchedAt + settings.cache.routeTtlDays * 24 * 60 * 60 * 1000
  };
  await chrome.storage.local.set({ [routeSnapRadiusHintKey(request)]: hint });
  devLog("route", "snap radius hint PUT", {
    target: request.target,
    provider: request.provider,
    mode: request.mode,
    targetRadius: radius,
    expiresAt: hint.expiresAt
  });
}

function geocodeSuggestionsStorageKey(query: string): string {
  return `hikr.geocode.photon.suggestions.${normalizeGeocodeQuery(query)}`;
}

async function waitForGeocodeCooldown(): Promise<void> {
  geocodeCooldownQueue = geocodeCooldownQueue.catch(() => undefined).then(async () => {
    const elapsed = Date.now() - lastGeocodeFetchAt;
    if (elapsed < 1000) await sleep(1000 - elapsed);
    lastGeocodeFetchAt = Date.now();
  });
  await geocodeCooldownQueue;
}

function photonDisplayName(properties: Record<string, unknown>): string {
  const parts = [
    properties.name,
    properties.street,
    properties.housenumber,
    properties.postcode,
    properties.city,
    properties.state,
    properties.country
  ].filter(Boolean);
  return [...new Set(parts.map(String))].join(", ");
}

function geocodeFromPhotonFeature(feature: unknown, query: string, id: string): GeocodeResult | undefined {
  const item = feature as {
    geometry?: { coordinates?: unknown[] };
    properties?: Record<string, unknown>;
  } | undefined;
  const coordinates = item?.geometry?.coordinates;
  const lng = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const now = Date.now();
  return {
    id,
    provider: "photon",
    query: query.trim(),
    displayName: photonDisplayName(item?.properties ?? {}) || query.trim(),
    coordinates: { lat, lng },
    fetchedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000
  };
}

async function geocodeLocation(query: string): Promise<GeocodeResult | undefined> {
  const normalized = normalizeGeocodeQuery(query);
  if (!normalized) return undefined;
  const key = geocodeStorageKey(normalized);
  const cached = (await chrome.storage.local.get(key))[key] as GeocodeResult | undefined;
  if (cached?.expiresAt && cached.expiresAt > Date.now()) return cached;

  const settings = await loadSettings();
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", settings.language ?? "de");
  await waitForGeocodeCooldown();
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Photon geocoding failed: ${response.status}`);
  const data = await response.json();
  const result = geocodeFromPhotonFeature(data?.features?.[0], query, key);
  if (!result) return undefined;
  await chrome.storage.local.set({ [key]: result });
  return result;
}

async function geocodeSuggestions(query: string): Promise<GeocodeResult[]> {
  const normalized = normalizeGeocodeQuery(query);
  if (normalized.length < 3) return [];
  const key = geocodeSuggestionsStorageKey(normalized);
  const cached = (await chrome.storage.local.get(key))[key] as { results: GeocodeResult[]; expiresAt: number } | undefined;
  if (cached?.expiresAt && cached.expiresAt > Date.now()) return cached.results;

  const settings = await loadSettings();
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", settings.language ?? "de");
  await waitForGeocodeCooldown();
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Photon geocoding suggestions failed: ${response.status}`);
  const data = await response.json();
  const seen = new Set<string>();
  const results = ((data?.features ?? []) as unknown[])
    .map((feature, index) => geocodeFromPhotonFeature(feature, query, `${key}.${index}`))
    .filter((item): item is GeocodeResult => Boolean(item))
    .filter((item) => {
      const dedupeKey = `${item.displayName}|${item.coordinates.lat.toFixed(5)},${item.coordinates.lng.toFixed(5)}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  const storagePatch: Record<string, unknown> = {
    [key]: { results, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  };
  for (const result of results) storagePatch[geocodeStorageKey(result.displayName)] = result;
  await chrome.storage.local.set(storagePatch);
  return results;
}

async function migrateUserscriptSettings(values: Record<string, string | null>) {
  const settings = await loadSettings();
  if (settings.migration.userscriptMigratedAt) return { migrated: false, settings };

  const patch = {
    provider: {
      ...settings.provider,
      apiKeys: {
        ...settings.provider.apiKeys,
        ...(values.ors_apikey ? { ors: values.ors_apikey } : {}),
        ...(values.gm_apikey ? { google: values.gm_apikey } : {})
      }
    },
    search: {
      ...settings.search,
      extraPagesToLoad: Number(values.load_pages ?? settings.search.extraPagesToLoad) || settings.search.extraPagesToLoad
    },
    location: {
      ...settings.location,
      fallbackStart: values.start_co
        ? values.start_co.split(",").length >= 2
          ? { lat: Number(values.start_co.split(",")[0]), lng: Number(values.start_co.split(",")[1]) }
          : settings.location.fallbackStart
        : settings.location.fallbackStart
    },
    migration: { userscriptMigratedAt: Date.now() }
  };
  return { migrated: true, settings: await patchSettings(patch) };
}

async function handleMessage(message: MessageRequest): Promise<MessageResponse> {
  devLog("msg", message.type, "url" in message ? message.url : "");
  if (message.type === "GET_SETTINGS") return { settings: await loadSettings() };
  if (message.type === "SAVE_SETTINGS") {
    await saveSettings(message.settings);
    return { ok: true };
  }
  if (message.type === "SAVE_SAVED_LOCATIONS") {
    const next = await patchSettings({ savedLocations: message.savedLocations });
    return { settings: next };
  }
  if (message.type === "SAVE_SEARCH_PRESETS") {
    const next = await patchSettings({ searchPresets: message.searchPresets });
    return { settings: next };
  }
  if (message.type === "GET_CACHE_STATS") return { stats: await cache.stats() };
  if (message.type === "CLEAR_CACHE") {
    await cache.clearAll();
    return { ok: true };
  }
  if (message.type === "CLEAR_ROUTES") {
    await cache.clearRoutes();
    return { ok: true };
  }
  if (message.type === "FETCH_HIKR_PAGE") return { html: await fetchText(message.url) };
  if (message.type === "GEOCODE_LOCATION") return { geocode: await geocodeLocation(message.query) };
  if (message.type === "GEOCODE_SUGGESTIONS") return { geocodes: await geocodeSuggestions(message.query) };
  if (message.type === "GET_CACHED_TOUR") {
    const cached = await cache.getTour(message.id);
    const fresh = cached && cached.cacheVersion === TOUR_CACHE_VERSION ? cached : undefined;
    devLog("cache", "GET tour", message.id, fresh ? "HIT" : cached ? `STALE v${cached.cacheVersion ?? "?"}` : "MISS");
    return { tour: fresh };
  }
  if (message.type === "PUT_CACHED_TOUR") {
    devLog("cache", "PUT tour", message.tour.id, { title: message.tour.title, missing: message.tour.missingFields });
    await cache.putTour(message.tour);
    return { ok: true };
  }
  if (message.type === "GET_CACHED_WAYPOINT") {
    const cached = await cache.getWaypoint(message.id);
    devLog("cache", "GET waypoint", message.id, cached ? "HIT" : "MISS");
    return { waypoint: cached };
  }
  if (message.type === "PUT_CACHED_WAYPOINT") {
    devLog("cache", "PUT waypoint", message.waypoint.id, { name: message.waypoint.name });
    await cache.putWaypoint(message.waypoint);
    return { ok: true };
  }
  if (message.type === "GET_ROUTE") {
    const settings = await loadSettings();
    const id = routeCacheId(message.request, settings, message.tourId);
    devLog("route", "GET_ROUTE", {
      id,
      provider: message.request.provider,
      mode: message.request.mode,
      start: message.request.start,
      target: message.request.target
    });
    const cached = await cache.getRoute(id);
    if (cached && routeCacheIsFresh(cached)) {
      devLog("route", "cache HIT", {
        id,
        status: cached.routeStatus ?? "ok",
        expiresAt: cached.expiresAt,
        distance: cached.routeStatus === "unroutable" ? undefined : cached.distanceText,
        duration: cached.routeStatus === "unroutable" ? undefined : cached.durationText,
        snapRadiiMeters: cached.routeStatus === "unroutable" ? undefined : cached.snapRadiiMeters,
        error: cached.routeStatus === "unroutable" ? cached.error : undefined
      });
      return routeResponseFromEntry(cached);
    }
    if (cached) devLog("route", "cache STALE", { id, expiresAt: cached.expiresAt, now: Date.now() });
    else devLog("route", "cache MISS", { id });
    const pending = routeInFlight.get(id);
    if (pending) {
      devLog("route", "in-flight HIT", { id });
      return routeResponseFromEntry(await pending);
    }
    const provider = routeProviders[message.request.provider];
    const pendingRoute = (async () => {
      const snapHint = await getRouteSnapRadiusHint(message.request);
      const routeRequest = snapHint
        ? {
            ...message.request,
            snapRadiiMeters: {
              ...message.request.snapRadiiMeters,
              target: snapHint.targetRadius
            }
          }
        : message.request;
      if (snapHint) {
        devLog("route", "snap radius hint HIT", {
          id,
          target: message.request.target,
          targetRadius: snapHint.targetRadius,
          expiresAt: snapHint.expiresAt
        });
      }
      await waitForRouteCooldown(settings);
      devLog("route", "provider call", {
        id,
        provider: provider.id,
        start: routeRequest.start,
        target: routeRequest.target,
        snapRadiiMeters: routeRequest.snapRadiiMeters
      });
      try {
        const result = await provider.getRoute(routeRequest);
        await rememberRouteSnapRadiusHint(message.request, settings, result.snapRadiiMeters?.target);
        const route = toRouteCacheRecord(id, routeRequest, settings, result);
        await cache.putRoute(route);
        devLog("route", "cache PUT", {
          id,
          status: route.routeStatus,
          distance: route.distanceText,
          duration: route.durationText,
          snapRadiiMeters: route.snapRadiiMeters,
          expiresAt: route.expiresAt
        });
        return route;
      } catch (error) {
        const messageText = String((error as { message?: unknown } | undefined)?.message ?? error);
        if (!isUnroutableRouteErrorMessage(messageText)) throw error;
        const routeFailure = toRouteFailureCacheRecord(id, routeRequest, settings, messageText);
        await cache.putRoute(routeFailure);
        devLog("route", "negative cache PUT", { id, status: routeFailure.routeStatus, error: routeFailure.error, expiresAt: routeFailure.expiresAt });
        return routeFailure;
      }
    })();
    routeInFlight.set(id, pendingRoute);
    try {
      return routeResponseFromEntry(await pendingRoute);
    } finally {
      routeInFlight.delete(id);
    }
  }
  if (message.type === "EXPORT_EXCEL") {
    await downloadExcel(toursToExcel(message.request), message.request.filename ?? "HIKR_TOUREN.xlsx");
    return { ok: true };
  }
  if (message.type === "FETCH_PHOTO_ANNOTATIONS") {
    const { photoId } = message;
    const cacheKey = `hikr.photo.annotations.${photoId}`;
    const cached = (await chrome.storage.local.get(cacheKey))[cacheKey] as PhotoAnnotationCache | undefined;
    if (cached?.expiresAt && cached.expiresAt > Date.now()) return { annotations: cached };
    const html = await fetchText(buildPhotoPageUrl(photoId));
    const peaks = parsePhotoAnnotations(html);
    const record: PhotoAnnotationCache = {
      photoId,
      peaks,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    await chrome.storage.local.set({ [cacheKey]: record });
    devLog("photo", "annotations fetched", { photoId, peaks: peaks.length });
    return { annotations: record };
  }
  if (message.type === "MIGRATE_USERSCRIPT_SETTINGS") return migrateUserscriptSettings(message.values);
  if (message.type === "OPEN_OPTIONS_PAGE") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
  if (message.type === "OPEN_EXTERNAL_URL") {
    const url = new URL(message.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported external URL");
    await chrome.tabs.create({ url: url.href });
    return { ok: true };
  }
  throw new Error(`Unknown message: ${(message as MessageRequest).type}`);
}

chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message: MessageRequest, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => {
    devWarn("msg", "handler threw", message.type, error);
    console.error("HIKR handler error", message.type, error);
    sendResponse({ ok: false, error: String(error?.message ?? error) });
  });
  return true;
});
