import { sendMessage } from "../../shared/messages";
import type { Coordinates, RouteCacheRecord, RouteProviderId } from "../../shared/types";
import { parseCoordinateInput } from "../../shared/coordinates";
import { t } from "../../shared/i18n";
import { devLog, devWarn } from "../../shared/dev-log";
import { routeStartCell } from "../../shared/route-cache";
import { normalizeHikrUrl, isAutoRoutePageType } from "../../shared/url";
import { getBrowserLocation } from "../dom";
import { writeDriveSortData } from "../sort-data";
import { EVT_TOUR_READY, beginWork, endWork, isIdle, onPipelineChange, type TourReadyDetail } from "../pipeline-status";
import type { HikrFeature } from "../feature-types";
import { ensureEnrichmentPipeline } from "./tour-details";
import { loadWaypoint } from "./waypoint-gmaps-links";

async function getStart(settingsStart: Coordinates | undefined, preferBrowser: boolean): Promise<Coordinates | undefined> {
  if (preferBrowser) return (await getBrowserLocation()) ?? settingsStart;
  return settingsStart ?? (await getBrowserLocation());
}

function routeStartInput(): HTMLInputElement | undefined {
  return document.querySelector<HTMLInputElement>("#hikr-ext-route-start-input") ?? undefined;
}

function routeStartSuggestions(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>("#hikr-ext-route-start-suggestions") ?? undefined;
}

function routeStartClearBtn(): HTMLButtonElement | undefined {
  return document.querySelector<HTMLButtonElement>("#hikr-ext-route-start-clear") ?? undefined;
}

function routeAutoToggle(): HTMLInputElement | undefined {
  return document.querySelector<HTMLInputElement>("#hikr-ext-route-auto") ?? undefined;
}

function routeButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[data-hikr-action="routes"]')];
}

// Counts the per-tour route pills in the result list. Every routable tour (waypoint
// coordinates known) gets exactly one ".hikr-ext-route-result" — a pending one while
// its drive-time is computed, then a resolved/unavailable one. Non-routable tours
// (no waypoint) never get a pill, so they correctly stay out of the total. The fiche
// table and list-cell variants use different classes and are not counted here.
function countRoutePills(): { loaded: number; total: number } {
  const pills = document.querySelectorAll(".hikr-ext-route-result");
  let loaded = 0;
  for (const pill of pills) {
    if (!pill.classList.contains("hikr-ext-route-pending")) loaded++;
  }
  return { loaded, total: pills.length };
}

// Drives the spinner + "(loaded/total)" counter shown next to the auto-routes toggle.
// Both are visible only while auto-routing is on and the pipeline still has work in
// flight (pagination prefetch, enrichment or routing). The total climbs as enrichment
// turns prefetched tours into routable ones; loaded climbs as drive-times resolve and
// always catches up to total when the pipeline goes idle.
function syncRouteAutoStatus(): void {
  const toggle = routeAutoToggle();
  const active = Boolean(toggle?.checked) && !isIdle();
  const spinner = document.getElementById("hikr-ext-route-auto-spinner");
  if (spinner) (spinner as HTMLElement).hidden = !active;
  const counter = document.getElementById("hikr-ext-route-auto-count");
  if (counter) {
    const { loaded, total } = countRoutePills();
    counter.textContent = `(${loaded}/${total})`;
    (counter as HTMLElement).hidden = !active || total === 0;
  }
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

let suggestTimer: number | undefined;
let suggestSeq = 0;

function setupRouteStartSuggestions(): void {
  const input = routeStartInput();
  const list = routeStartSuggestions();
  const clearBtn = routeStartClearBtn();
  if (!input || !list || input.dataset.hikrSuggestReady) return;
  input.dataset.hikrSuggestReady = "true";

  const safeList = list;
  const safeInput = input;
  function hideSuggestions() {
    safeList.hidden = true;
    safeList.innerHTML = "";
  }

  function syncClearBtn() {
    if (clearBtn) clearBtn.hidden = !safeInput.value;
  }

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    localStorage.removeItem("hikr.ext.route.start");
    hideSuggestions();
    syncClearBtn();
    input.focus();
  });

  input.addEventListener("input", () => {
    localStorage.setItem("hikr.ext.route.start", input.value.trim());
    syncClearBtn();
    window.clearTimeout(suggestTimer);
    const query = input.value.trim();
    if (parseCoordinateInput(query) || query.length < 3) { hideSuggestions(); return; }
    const seq = ++suggestSeq;
    suggestTimer = window.setTimeout(async () => {
      try {
        const response = await sendMessage({ type: "GEOCODE_SUGGESTIONS", query });
        if (seq !== suggestSeq) return;
        const geocodes = "geocodes" in response ? response.geocodes : [];
        if (geocodes.length === 0) { hideSuggestions(); return; }
        safeList.innerHTML = geocodes.map((item) =>
          `<li><button type="button" data-lat="${item.coordinates.lat}" data-lng="${item.coordinates.lng}" data-name="${esc(item.displayName)}">${esc(item.displayName)}</button></li>`
        ).join("");
        safeList.hidden = false;
      } catch (error) {
        console.warn("HIKR geocode suggestions failed", error);
      }
    }, 650);
  });

  safeList.addEventListener("mousedown", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-name]");
    if (!btn) return;
    event.preventDefault();
    input.value = btn.dataset.name ?? "";
    localStorage.setItem("hikr.ext.route.start", input.value);
    hideSuggestions();
    syncClearBtn();
    input.focus();
  });

  input.addEventListener("blur", () => window.setTimeout(hideSuggestions, 150));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSuggestions();
  });
}

function setupAutoRoutes(context: Parameters<HikrFeature["run"]>[0]): void {
  // Automatic drive-time routing runs only on page types where the auto toggle is
  // rendered (see panel.ts). The manual "Fahrtzeiten" button stays available
  // everywhere via calculateVisibleRoutes().
  if (!isAutoRoutePageType(context.page.pageType)) return;
  const toggle = routeAutoToggle();
  if (!toggle || toggle.dataset.hikrAutoReady) return;
  toggle.dataset.hikrAutoReady = "true";
  const syncRoutesButton = () => {
    const button = document.querySelector<HTMLElement>('.hikr-ext-panel [data-hikr-action="routes"]');
    if (button) button.hidden = toggle.checked;
  };
  syncRoutesButton();
  // Spinner + "(loaded/total)" counter next to the label show while auto-routing
  // still has work in flight — including ongoing pagination prefetch (the pipeline
  // counter covers it). See syncRouteAutoStatus for the counting model.
  onPipelineChange(syncRouteAutoStatus);
  syncRouteAutoStatus();
  toggle.addEventListener("change", () => {
    localStorage.setItem("hikr.ext.route.auto", toggle.checked ? "true" : "false");
    syncRoutesButton();
    invalidateRouteContext();
    if (toggle.checked) startAutoRouting(context);
    syncRouteAutoStatus();
  });
  if (toggle.checked) startAutoRouting(context);
}

async function getCustomStart(context: Parameters<HikrFeature["run"]>[0]): Promise<Coordinates | undefined> {
  const input = routeStartInput();
  const raw = input?.value.trim() ?? "";
  localStorage.setItem("hikr.ext.route.start", raw);
  if (!raw) return undefined;
  const parsed = parseCoordinateInput(raw);
  if (parsed) return parsed;
  context.log("Startpunkt wird gesucht...");
  const response = await sendMessage({ type: "GEOCODE_LOCATION", query: raw });
  const geocode = "geocode" in response ? response.geocode : undefined;
  if (!geocode) {
    context.log(t("route_start_not_found", { query: raw }));
    return undefined;
  }
  context.log(t("route_start_found", { place: geocode.displayName }));
  return geocode.coordinates;
}

function routeTargetKey(target: Coordinates): string {
  return `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
}

function validRouteResponse(response: unknown): response is { route: RouteCacheRecord } {
  const route = (response as { route?: Partial<RouteCacheRecord> } | undefined)?.route;
  return Boolean(route?.distanceText && route?.durationText);
}

function routeFailureResponse(response: unknown): response is { routeFailure: { error: string; expiresAt: number } } {
  return Boolean((response as { routeFailure?: { routeStatus?: string; error?: string } } | undefined)?.routeFailure?.error);
}

function gMapsRouteLink(start: Coordinates, target: Coordinates): string {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${target.lat},${target.lng}&travelmode=driving`;
  return `<a class="hikr-ext-gmaps-link hikr-ext-external-map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Route in Google Maps öffnen"><span aria-hidden="true">↗</span></a>`;
}

function routeResultHtml(route: RouteCacheRecord, provider: string, startCell: string, start?: Coordinates, target?: Coordinates): string {
  const mapsLink = start && target ? ` ${gMapsRouteLink(start, target)}` : "";
  return [
    `<div class="hikr-ext-route-result" data-route-provider="${esc(provider)}" data-route-start-cell="${esc(startCell)}" title="Fahrtzeit">`,
    `<span class="hikr-ext-route-pill" title="Distanz / Fahrzeit"><span class="hikr-ext-route-icon" aria-hidden="true">🚗</span>${esc(route.distanceText)} <span class="hikr-ext-route-time">(${esc(route.durationText)})</span></span>${mapsLink}`,
    `</div>`
  ].join("");
}

function hasMatchingRouteResult(detail: HTMLElement, provider: string, startCell: string): boolean {
  const existing = detail.querySelector<HTMLElement>(".hikr-ext-route-result");
  return Boolean(existing?.dataset.routeProvider === provider && existing.dataset.routeStartCell === startCell);
}

function removeStaleRouteResult(detail: HTMLElement, provider: string, startCell: string): boolean {
  const existing = detail.querySelector<HTMLElement>(".hikr-ext-route-result");
  if (!existing || hasMatchingRouteResult(detail, provider, startCell)) return false;
  existing.remove();
  return true;
}

function setRouteButtonLoading(loading: boolean): void {
  for (const button of routeButtons()) {
    if (loading) {
      button.dataset.hikrOriginalLabel ||= button.textContent ?? "";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.classList.add("hikr-ext-btn-loading");
    } else {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.classList.remove("hikr-ext-btn-loading");
      if (button.dataset.hikrOriginalLabel) button.textContent = button.dataset.hikrOriginalLabel;
    }
  }
}

function placeRouteElement(detail: HTMLElement, element: HTMLElement): void {
  const waypointList = detail.querySelector<HTMLElement>(".hikr-ext-waypoint-list");
  if (waypointList) waypointList.insertAdjacentElement("beforebegin", element);
  else detail.append(element);
}

// A loading pill shown the instant a tour is taken into account for routing (auto
// on, or the manual button), so the user sees every considered tour — including
// tours added later by the pagination loader.
function insertRoutePlaceholder(detail: HTMLElement): void {
  if (detail.querySelector(".hikr-ext-route-result")) return; // real or pending pill already there
  const el = document.createElement("div");
  el.className = "hikr-ext-route-result hikr-ext-route-pending";
  el.title = "Fahrtzeit wird berechnet…";
  el.innerHTML = `<span class="hikr-ext-route-pill"><span class="hikr-ext-route-spinner" aria-hidden="true"></span> <span class="hikr-ext-route-time">Fahrtzeit…</span></span>`;
  placeRouteElement(detail, el);
}

function markRouteUnavailable(detail: HTMLElement): void {
  const pending = detail.querySelector<HTMLElement>(".hikr-ext-route-pending");
  if (!pending) return;
  pending.classList.remove("hikr-ext-route-pending");
  pending.classList.add("hikr-ext-route-unavailable");
  pending.title = "Keine Route gefunden";
  pending.innerHTML = `<span class="hikr-ext-route-pill"><span class="hikr-ext-route-icon" aria-hidden="true">🚗</span>–</span>`;
}

function insertRouteResult(detail: HTMLElement, route: RouteCacheRecord, provider: string, startCell: string, start?: Coordinates, target?: Coordinates): void {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = routeResultHtml(route, provider, startCell, start, target);
  const routeElement = wrapper.firstElementChild;
  if (!(routeElement instanceof HTMLElement)) return;
  // Replace any pending/stale pill with the freshly computed one.
  detail.querySelector(".hikr-ext-route-result")?.remove();
  placeRouteElement(detail, routeElement);
  writeDriveSortData(detail.closest<HTMLElement>(".content-list"), route);
}

function insertRouteIntoFicheTable(detail: HTMLElement, route: RouteCacheRecord, provider: string, startCell: string, start?: Coordinates, target?: Coordinates): void {
  const tbody = document.querySelector<HTMLTableSectionElement>("table.fiche_rando tbody");
  if (!tbody) return;
  const detailUrl = detail.dataset.tourUrl ?? "";
  try {
    if (new URL(detailUrl).pathname !== new URL(location.href).pathname) return;
  } catch { return; }
  const mapsLink = start && target ? ` ${gMapsRouteLink(start, target)}` : "";
  for (const el of [...tbody.querySelectorAll(".hikr-ext-fiche-route-row")]) el.remove();
  tbody.insertAdjacentHTML("beforeend", `
    <tr class="hikr-ext-fiche-route-row" data-route-provider="${esc(provider)}" data-route-start-cell="${esc(startCell)}">
      <td class="fiche_rando_b">Fahrtstrecke:</td><td class="fiche_rando">🚗 ${esc(route.distanceText)}${mapsLink}</td>
    </tr>
    <tr class="hikr-ext-fiche-route-row">
      <td class="fiche_rando_b">Fahrtdauer:</td><td class="fiche_rando">⌚ ${esc(route.durationText)}</td>
    </tr>`);
}

function insertRouteIntoListCell(detail: HTMLElement, route: RouteCacheRecord, provider: string, startCell: string, start?: Coordinates, target?: Coordinates): void {
  const thumbTd = detail.closest("td");
  const textTd = thumbTd?.nextElementSibling;
  if (!(textTd instanceof HTMLElement)) return;
  textTd.querySelector(".hikr-ext-list-route")?.remove();
  const firstLink = textTd.querySelector<HTMLAnchorElement>("a[href]");
  if (!firstLink) return;
  const mapsLink = start && target ? ` ${gMapsRouteLink(start, target)}` : "";
  const div = document.createElement("div");
  div.className = "hikr-ext-list-route";
  div.dataset.routeProvider = provider;
  div.dataset.routeStartCell = startCell;
  div.innerHTML = `<span class="hikr-ext-route-pill"><span class="hikr-ext-route-icon" aria-hidden="true">🚗</span>${esc(route.distanceText)} <span class="hikr-ext-route-time">(${esc(route.durationText)})</span></span>${mapsLink}`;
  firstLink.insertAdjacentElement("afterend", div);
}

let activeRouteCalculation: Promise<void> | undefined;

async function insertFicheTableRouteForTourPage(
  context: Parameters<HikrFeature["run"]>[0],
  start: Coordinates,
  apiKey: string,
  startCell: string,
  routes: RouteCacheRecord[]
): Promise<void> {
  const tbody = document.querySelector<HTMLTableSectionElement>("table.fiche_rando tbody");
  if (!tbody) return;
  const existing = tbody.querySelector<HTMLElement>(".hikr-ext-fiche-route-row");
  if (existing?.dataset.routeStartCell === startCell) return;

  const firstWpAnchor = tbody.querySelector<HTMLAnchorElement>('a[href*="/dir/"]');
  if (!firstWpAnchor) return;

  const waypoint = await loadWaypoint(normalizeHikrUrl(firstWpAnchor.href));
  if (!waypoint?.coordinates) return;

  const target = waypoint.coordinates;
  const targetKey = `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
  devLog("route", "fiche table route", { targetKey, target, start, startCell });

  try {
    const response = await sendMessage({
      type: "GET_ROUTE",
      request: {
        provider: context.settings.provider.routeProvider,
        apiKey,
        mode: "driving-car",
        start,
        target
      }
    });
    if (!validRouteResponse(response)) return;
    routes.push(response.route);
    const mapsLink = gMapsRouteLink(start, target);
    for (const el of [...tbody.querySelectorAll(".hikr-ext-fiche-route-row")]) el.remove();
    tbody.insertAdjacentHTML("beforeend", `
      <tr class="hikr-ext-fiche-route-row" data-route-start-cell="${esc(startCell)}">
        <td class="fiche_rando_b">Fahrtstrecke:</td><td class="fiche_rando">🚗 ${esc(response.route.distanceText)} ${mapsLink}</td>
      </tr>
      <tr class="hikr-ext-fiche-route-row">
        <td class="fiche_rando_b">Fahrtdauer:</td><td class="fiche_rando">⌚ ${esc(response.route.durationText)}</td>
      </tr>`);
    devLog("route", "fiche table route inserted", { distance: response.route.distanceText, duration: response.route.durationText });
  } catch (error) {
    devWarn("route", "fiche table route failed", { targetKey, error });
  }
}

interface RouteCtx {
  start: Coordinates;
  apiKey: string;
  provider: RouteProviderId;
  startCell: string;
}

// Resolved once per activation (geocoding the start can be expensive) and cached —
// including the negative result, so a missing key does not re-geocode per tour.
let routeContextPromise: Promise<RouteCtx | null> | undefined;
// Coalesces concurrent route requests by start+target: many tours share one start
// waypoint, so the second tour reuses the first's promise and just renders into its
// own detail element.
const routePromises = new Map<string, Promise<RouteCacheRecord | undefined>>();

function invalidateRouteContext(): void {
  routeContextPromise = undefined;
  routePromises.clear();
}

function resolveRouteContext(context: Parameters<HikrFeature["run"]>[0]): Promise<RouteCtx | null> {
  if (!routeContextPromise) {
    routeContextPromise = (async () => {
      const customStart = await getCustomStart(context);
      const start = customStart ?? await getStart(context.settings.location.fallbackStart, context.settings.location.preferBrowserLocation);
      const apiKey = context.settings.provider.apiKeys[context.settings.provider.routeProvider];
      if (!start || !apiKey) {
        devWarn("route", "no route context", { hasStart: Boolean(start), hasApiKey: Boolean(apiKey) });
        return null;
      }
      return { start, apiKey, provider: context.settings.provider.routeProvider, startCell: routeStartCell({ start }) };
    })();
  }
  return routeContextPromise;
}

function fetchRouteForTarget(target: Coordinates, ctx: RouteCtx): Promise<RouteCacheRecord | undefined> {
  const key = `${ctx.startCell}|${routeTargetKey(target)}`;
  const existing = routePromises.get(key);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const response = await sendMessage({
        type: "GET_ROUTE",
        request: { provider: ctx.provider, apiKey: ctx.apiKey, mode: "driving-car", start: ctx.start, target }
      });
      if (routeFailureResponse(response) || !validRouteResponse(response)) return undefined;
      return response.route;
    } catch (error) {
      devWarn("route", "GET_ROUTE threw", { target, error });
      return undefined;
    }
  })();
  // Cache only successful results: a failed/empty result must not poison every other
  // tour that shares this target, and should be retryable. The service worker still
  // negative-caches genuine failures, so re-requests stay cheap.
  promise.then((route) => {
    if (!route) routePromises.delete(key);
  }).catch(() => routePromises.delete(key));
  routePromises.set(key, promise);
  return promise;
}

// Compute (or reuse) the route for one tour detail and render it. Shared by the
// per-tour auto path and the manual batch; both guard with hasMatchingRouteResult,
// so they never double-insert.
async function routeOneDetail(detail: HTMLElement, target: Coordinates, ctx: RouteCtx): Promise<void> {
  if (hasMatchingRouteResult(detail, ctx.provider, ctx.startCell)) return;
  removeStaleRouteResult(detail, ctx.provider, ctx.startCell); // drop a pill from a previous start
  insertRoutePlaceholder(detail); // spinner shown while we wait for the result
  syncRouteAutoStatus(); // a new routable tour just appeared → bump the (loaded/total) counter now
  const route = await fetchRouteForTarget(target, ctx);
  if (hasMatchingRouteResult(detail, ctx.provider, ctx.startCell)) return; // another pass won the race
  if (!route) {
    markRouteUnavailable(detail);
    return;
  }
  insertRouteResult(detail, route, ctx.provider, ctx.startCell, ctx.start, target);
  insertRouteIntoFicheTable(detail, route, ctx.provider, ctx.startCell, ctx.start, target);
  insertRouteIntoListCell(detail, route, ctx.provider, ctx.startCell, ctx.start, target);
}

let autoRoutingListenerAdded = false;

// Drives one tour's route, owning the pipeline "route" counter. beginWork runs
// synchronously (before any await) so the enrich→route handoff has no gap where the
// pipeline could falsely look idle.
function routeReadyDetail(detail: HTMLElement, target: Coordinates, context: Parameters<HikrFeature["run"]>[0]): void {
  beginWork("route");
  void (async () => {
    const ctx = await resolveRouteContext(context);
    if (ctx) await routeOneDetail(detail, target, ctx);
  })()
    .catch((error) => devWarn("route", "auto route failed", error))
    .finally(() => endWork("route"));
}

// Routes every currently-ready tour (and the single-tour-page fiche table). Safe to
// call repeatedly: already-routed tours are skipped, shared targets coalesce.
function routeReadyNow(context: Parameters<HikrFeature["run"]>[0]): void {
  for (const detail of document.querySelectorAll<HTMLElement>(".hikr-ext-tour-details[data-lat][data-lng]")) {
    const target = { lat: Number(detail.dataset.lat), lng: Number(detail.dataset.lng) };
    if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) routeReadyDetail(detail, target, context);
  }
  // Single tour pages have no list card: route to the first fiche waypoint directly.
  void (async () => {
    const ctx = await resolveRouteContext(context);
    if (ctx) await insertFicheTableRouteForTourPage(context, ctx.start, ctx.apiKey, ctx.startCell, []);
  })();
}

// Starts/keeps event-driven auto-routing: every tour computes its driving time the
// moment its waypoint coordinates are known, independent of pagination progress.
// The tour-ready listener is attached once; the catch-up pass runs on every call so
// re-activation (or a changed start) re-routes the visible tours.
export function startAutoRouting(context: Parameters<HikrFeature["run"]>[0]): void {
  ensureEnrichmentPipeline(context); // ensure tours get fetched so tour-ready fires
  if (!autoRoutingListenerAdded) {
    autoRoutingListenerAdded = true;
    document.addEventListener(EVT_TOUR_READY, (event) => {
      const ready = (event as CustomEvent<TourReadyDetail>).detail;
      if (ready?.detail && ready.target) routeReadyDetail(ready.detail, ready.target, context);
    });
  }
  routeReadyNow(context);
}

// Manual "Fahrtzeiten" button: re-resolve the start (the input may have changed),
// then activate routing — which both routes the visible tours now AND keeps up with
// tours added later by the pagination loader.
export async function calculateVisibleRoutes(context: Parameters<HikrFeature["run"]>[0]): Promise<void> {
  if (activeRouteCalculation) {
    devLog("route", "calculateVisibleRoutes already running");
    return activeRouteCalculation;
  }
  setRouteButtonLoading(true);
  invalidateRouteContext();
  activeRouteCalculation = (async () => {
    const ctx = await resolveRouteContext(context);
    if (!ctx) {
      context.log("Kein Startpunkt oder API-Key verfügbar");
      return;
    }
    startAutoRouting(context);
  })().finally(() => {
    activeRouteCalculation = undefined;
    setRouteButtonLoading(false);
  });
  return activeRouteCalculation;
}

export const routesFeature: HikrFeature = {
  id: "routeTravelTimes",
  title: "Route Travel Times",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0,
  async run(context) {
    setupRouteStartSuggestions();
    setupAutoRoutes(context);
    document.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-hikr-action="routes"]');
      if (button) void calculateVisibleRoutes(context);
    });
  }
};
