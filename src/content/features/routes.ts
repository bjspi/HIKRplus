import { sendMessage } from "../../shared/messages";
import type { Coordinates, RouteCacheRecord } from "../../shared/types";
import { parseCoordinateInput } from "../../shared/coordinates";
import { t } from "../../shared/i18n";
import { devLog, devWarn } from "../../shared/dev-log";
import { routeStartCell } from "../../shared/route-cache";
import { normalizeHikrUrl } from "../../shared/url";
import { getBrowserLocation } from "../dom";
import type { HikrFeature } from "../feature-types";
import { enrichVisibleTours } from "./tour-details";
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

function routeAutoToggle(): HTMLInputElement | undefined {
  return document.querySelector<HTMLInputElement>("#hikr-ext-route-auto") ?? undefined;
}

function routeButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[data-hikr-action="routes"]')];
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

let suggestTimer: number | undefined;
let suggestSeq = 0;

function setupRouteStartSuggestions(): void {
  const input = routeStartInput();
  const list = routeStartSuggestions();
  if (!input || !list || input.dataset.hikrSuggestReady) return;
  input.dataset.hikrSuggestReady = "true";

  const safeList = list;
  function hideSuggestions() {
    safeList.hidden = true;
    safeList.innerHTML = "";
  }

  input.addEventListener("input", () => {
    localStorage.setItem("hikr.ext.route.start", input.value.trim());
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
    input.focus();
  });

  input.addEventListener("blur", () => window.setTimeout(hideSuggestions, 150));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSuggestions();
  });
}

function setupAutoRoutes(context: Parameters<HikrFeature["run"]>[0]): void {
  const toggle = routeAutoToggle();
  if (!toggle || toggle.dataset.hikrAutoReady) return;
  toggle.dataset.hikrAutoReady = "true";
  toggle.addEventListener("change", () => {
    localStorage.setItem("hikr.ext.route.auto", toggle.checked ? "true" : "false");
    if (toggle.checked) void calculateVisibleRoutes(context);
  });
  if (toggle.checked) window.setTimeout(() => void calculateVisibleRoutes(context), 500);
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

function insertRouteResult(detail: HTMLElement, route: RouteCacheRecord, provider: string, startCell: string, start?: Coordinates, target?: Coordinates): void {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = routeResultHtml(route, provider, startCell, start, target);
  const routeElement = wrapper.firstElementChild;
  if (!(routeElement instanceof HTMLElement)) return;
  const waypointList = detail.querySelector<HTMLElement>(".hikr-ext-waypoint-list");
  if (waypointList) waypointList.insertAdjacentElement("beforebegin", routeElement);
  else detail.append(routeElement);
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

const ROUTE_CONCURRENCY = 4;
let activeRouteCalculation: Promise<RouteCacheRecord[]> | undefined;

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

async function calculateVisibleRoutesInternal(context: Parameters<HikrFeature["run"]>[0]): Promise<RouteCacheRecord[]> {
  const customStart = await getCustomStart(context);
  const start = customStart ?? await getStart(context.settings.location.fallbackStart, context.settings.location.preferBrowserLocation);
  const apiKey = context.settings.provider.apiKeys[context.settings.provider.routeProvider];
  devLog("route", "calculateVisibleRoutes start", {
    provider: context.settings.provider.routeProvider,
    hasCustomStart: Boolean(customStart),
    hasStart: Boolean(start),
    hasApiKey: Boolean(apiKey),
    tourUrls: context.page.tourUrls.length
  });
  if (!start || !apiKey) {
    context.log(!start ? "Kein Startpunkt verfügbar" : "Kein API-Key für Route Provider");
    devWarn("route", "calculateVisibleRoutes aborted", {
      reason: !start ? "missing start" : "missing api key",
      provider: context.settings.provider.routeProvider
    });
    return [];
  }
  const routeStart = start;
  const routeApiKey = apiKey;
  await enrichVisibleTours(context.page.tourUrls, false, { waypointGmapsLinks: context.settings.ui.waypointGmapsLinks });
  const routes: RouteCacheRecord[] = [];
  const details = [...document.querySelectorAll<HTMLElement>(".hikr-ext-tour-details[data-lat][data-lng]")];
  const routeByTarget = new Map<string, RouteCacheRecord>();
  const detailsByTarget = new Map<string, { detail: HTMLElement; target: Coordinates }[]>();
  const startCell = routeStartCell({ start });
  let skippedExisting = 0;
  let removedStale = 0;
  let invalidTargets = 0;

  for (const detail of details) {
    if (hasMatchingRouteResult(detail, context.settings.provider.routeProvider, startCell)) {
      skippedExisting++;
      continue;
    }
    if (removeStaleRouteResult(detail, context.settings.provider.routeProvider, startCell)) {
      removedStale++;
    }
    const target = { lat: Number(detail.dataset.lat), lng: Number(detail.dataset.lng) };
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
      invalidTargets++;
      continue;
    }
    const key = routeTargetKey(target);
    detailsByTarget.set(key, [...(detailsByTarget.get(key) ?? []), { detail, target }]);
  }

  const routeJobs = [...detailsByTarget.entries()];
  devLog("route", "route jobs prepared", {
    detailCount: details.length,
    uniqueTargets: routeJobs.length,
    skippedExisting,
    removedStale,
    invalidTargets,
    start: routeStart,
    startCell,
    concurrency: ROUTE_CONCURRENCY
  });
  let nextJob = 0;
  let failedRoutes = 0;
  async function worker(): Promise<void> {
    while (nextJob < routeJobs.length) {
      const [targetKey, entries] = routeJobs[nextJob++]!;
      const target = entries[0]?.target;
      if (!target) continue;
      const pendingEntries = entries.filter(({ detail }) => !hasMatchingRouteResult(detail, context.settings.provider.routeProvider, startCell));
      if (pendingEntries.length === 0) {
        skippedExisting += entries.length;
        devLog("route", "skip route job already rendered", { targetKey, entries: entries.length, startCell });
        continue;
      }
      try {
        devLog("route", "request route", { targetKey, target, entries: pendingEntries.length, start: routeStart, startCell });
        const response = await sendMessage({
          type: "GET_ROUTE",
          request: {
            provider: context.settings.provider.routeProvider,
            apiKey: routeApiKey,
            mode: "driving-car",
            start: routeStart,
            target
          }
        });
        if (routeFailureResponse(response)) {
          failedRoutes++;
          devLog("route", "negative route cache", {
            targetKey,
            target,
            start: routeStart,
            error: response.routeFailure.error,
            expiresAt: response.routeFailure.expiresAt
          });
          continue;
        }
        if (!validRouteResponse(response)) {
          failedRoutes++;
          devWarn("route", "missing route response", { targetKey, target, start: routeStart, response });
          console.warn("HIKR route response missing route", { targetKey, target, start: routeStart, response });
          continue;
        }
        devLog("route", "route ok", {
          targetKey,
          distance: response.route.distanceText,
          duration: response.route.durationText,
          expiresAt: response.route.expiresAt
        });
        routeByTarget.set(targetKey, response.route);
        routes.push(response.route);
        for (const { detail } of pendingEntries) {
          if (!hasMatchingRouteResult(detail, context.settings.provider.routeProvider, startCell)) {
            insertRouteResult(detail, response.route, context.settings.provider.routeProvider, startCell, routeStart, target);
            insertRouteIntoFicheTable(detail, response.route, context.settings.provider.routeProvider, startCell, routeStart, target);
            insertRouteIntoListCell(detail, response.route, context.settings.provider.routeProvider, startCell, routeStart, target);
          }
        }
      } catch (error) {
        failedRoutes++;
        devWarn("route", "route calculation threw", { targetKey, target, start: routeStart, error });
        console.warn("HIKR route calculation failed", targetKey, error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ROUTE_CONCURRENCY, routeJobs.length) }, () => worker()));

  // Tour page: calculate route to the first fiche waypoint directly
  await insertFicheTableRouteForTourPage(context, routeStart, routeApiKey, startCell, routes);

  devLog("route", "calculateVisibleRoutes done", {
    renderedRoutes: routes.length,
    failedRoutes,
    uniqueTargets: routeJobs.length
  });
  context.log(`Fahrtzeiten: ${routes.length}`);
  return routes;
}

export async function calculateVisibleRoutes(context: Parameters<HikrFeature["run"]>[0]): Promise<RouteCacheRecord[]> {
  if (activeRouteCalculation) {
    devLog("route", "calculateVisibleRoutes already running");
    return activeRouteCalculation;
  }
  setRouteButtonLoading(true);
  activeRouteCalculation = calculateVisibleRoutesInternal(context).finally(() => {
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
