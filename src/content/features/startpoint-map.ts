import L from "leaflet";
import { sendMessage } from "../../shared/messages";
import { parseHtml, parseWaypointDocument } from "../../shared/parser";
import { getWaypointId } from "../../shared/url";
import type { MapPoint, TourCacheRecord, WaypointCacheRecord } from "../../shared/types";
import { detailHtml } from "../dom";
import type { HikrFeature } from "../feature-types";
import { enrichVisibleTours } from "./tour-details";

let activeMap: L.Map | undefined;
let activeMapRun = 0;
let mapLoading = false;
let mapBackdrop: HTMLElement | undefined;

function ensureMapBackdrop(): HTMLElement {
  if (mapBackdrop) return mapBackdrop;
  mapBackdrop = document.createElement("div");
  mapBackdrop.className = "hikr-ext-map-backdrop";
  mapBackdrop.setAttribute("hidden", "");
  document.body.appendChild(mapBackdrop);
  return mapBackdrop;
}

function showMapBackdrop(): void {
  ensureMapBackdrop().removeAttribute("hidden");
}

function hideMapBackdrop(): void {
  mapBackdrop?.setAttribute("hidden", "");
}

interface StartpointMapPoint extends MapPoint {
  tour?: TourCacheRecord;
  waypoint?: WaypointCacheRecord;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

async function loadWaypoint(url: string): Promise<WaypointCacheRecord | undefined> {
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

function tileLayer(context: Parameters<HikrFeature["run"]>[0]) {
  const mapyKey = context.settings.provider.apiKeys.mapy;
  if (context.settings.provider.mapProvider === "mapy" && mapyKey) {
    return L.tileLayer("https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey={apikey}", {
      apikey: mapyKey,
      attribution: 'Mapy.com &copy; Seznam.cz, a.s. and other contributors'
    } as L.TileLayerOptions & { apikey: string });
  }
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
}

function pointFromWaypoint(waypoint: WaypointCacheRecord): MapPoint | undefined {
  if (!waypoint.coordinates) return undefined;
  return {
    id: waypoint.id,
    title: waypoint.name ?? waypoint.id,
    url: waypoint.url,
    coordinates: waypoint.coordinates
  };
}

function pointFromTour(tour: TourCacheRecord, waypoint: WaypointCacheRecord | undefined): StartpointMapPoint | undefined {
  if (!waypoint?.coordinates) return undefined;
  return {
    id: tour.id,
    title: tour.title ?? waypoint.name ?? tour.id,
    url: tour.url,
    coordinates: waypoint.coordinates,
    tour,
    waypoint
  };
}

function routeResultForTour(tour: TourCacheRecord | undefined): string {
  if (!tour) return "";
  const detail = document.querySelector<HTMLElement>(`.hikr-ext-tour-details[data-tour-url="${CSS.escape(tour.url)}"]`);
  const route = detail?.querySelector<HTMLElement>(".hikr-ext-route-result")?.textContent?.trim();
  return route ? `<div class="hikr-ext-map-popup-route">${esc(route)}</div>` : "";
}

function popupHtml(point: StartpointMapPoint, context: Parameters<HikrFeature["run"]>[0]): string {
  const title = point.url
    ? `<a href="${point.url}" target="_blank" rel="noopener noreferrer">${esc(point.title)}</a>`
    : esc(point.title);
  const coords = `${point.coordinates.lat.toFixed(5)}, ${point.coordinates.lng.toFixed(5)}`;
  const details = point.tour ? detailHtml(point.tour, point.waypoint, context.settings) : "";
  return `
    <div class="hikr-ext-map-popup">
      <strong>${title}</strong>
      <div class="hikr-ext-map-popup-coords">${coords}</div>
      ${details ? `<div class="hikr-ext-map-popup-details">${details}</div>` : ""}
      ${routeResultForTour(point.tour)}
    </div>
  `;
}

function setMapButtonsLoading(loading: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-hikr-action="map"]')) {
    if (loading) {
      button.disabled = true;
      button.classList.add("hikr-ext-btn-loading");
      button.setAttribute("aria-busy", "true");
    } else {
      button.disabled = false;
      button.classList.remove("hikr-ext-btn-loading");
      button.setAttribute("aria-busy", "false");
    }
  }
}

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "hikr-ext-map-pin-icon",
    html: '<span class="hikr-ext-map-pin" aria-hidden="true"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

function ensureModal(root: HTMLElement): HTMLElement {
  let modal = root.querySelector<HTMLElement>(".hikr-ext-map-modal");
  if (modal) return modal;
  modal = document.createElement("section");
  modal.className = "hikr-ext-map-modal";
  modal.innerHTML = `
    <header>
      <strong>Tour-Startpunkte</strong>
      <button class="hikr-ext-btn" data-hikr-map-close>Schließen</button>
    </header>
    <div class="hikr-ext-map-status" aria-live="polite"></div>
    <div class="hikr-ext-map"></div>
  `;
  root.append(modal);
  modal.querySelector("[data-hikr-map-close]")?.addEventListener("click", () => {
    activeMapRun++;
    mapLoading = false;
    setMapButtonsLoading(false);
    activeMap?.remove();
    activeMap = undefined;
    modal!.style.display = "none";
    hideMapBackdrop();
  });
  return modal;
}

function setMapStatus(modal: HTMLElement, text: string): void {
  const status = modal.querySelector<HTMLElement>(".hikr-ext-map-status");
  if (status) status.textContent = text;
}

function resetMapContainer(modal: HTMLElement): HTMLElement {
  activeMap?.remove();
  activeMap = undefined;
  const previous = modal.querySelector<HTMLElement>(".hikr-ext-map");
  const container = document.createElement("div");
  container.className = "hikr-ext-map";
  previous?.replaceWith(container);
  return container;
}

function createMap(container: HTMLElement, context: Parameters<HikrFeature["run"]>[0]): L.Map {
  const map = L.map(container, { zoomControl: true });
  activeMap = map;
  tileLayer(context).addTo(map);
  map.setView([47.3, 8.2], 7);
  const invalidate = () => {
    if (activeMap === map) map.invalidateSize();
  };
  requestAnimationFrame(invalidate);
  window.setTimeout(invalidate, 80);
  window.setTimeout(invalidate, 250);
  return map;
}

export const startpointMapFeature: HikrFeature = {
  id: "startpointMap",
  title: "Startpoint Map",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0 || context.waypointUrls.length > 0,
  run(context) {
    document.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-hikr-action="map"]');
      if (!button) return;
      void (async () => {
        if (mapLoading) return;
        mapLoading = true;
        setMapButtonsLoading(true);
        const runId = ++activeMapRun;
        const modal = ensureModal(context.root);
        modal.style.display = "grid";
        showMapBackdrop();
        setMapStatus(modal, "Startpunkte werden geladen...");
        const container = resetMapContainer(modal);
        const map = createMap(container, context);
        const points: StartpointMapPoint[] = [];
        try {
          if (context.page.tourUrls.length > 0) {
            const { tours } = await enrichVisibleTours(context.page.tourUrls, false, {
              waypointGmapsLinks: context.settings.ui.waypointGmapsLinks
            });
            if (runId !== activeMapRun || activeMap !== map) return;
            let loaded = 0;
            for (const tour of tours) {
              loaded++;
              setMapStatus(modal, `Startpunkte werden geladen... ${loaded}/${tours.length}`);
              const waypoint = tour.startWaypointUrl ? await loadWaypoint(tour.startWaypointUrl) : undefined;
              if (runId !== activeMapRun || activeMap !== map) return;
              const point = pointFromTour(tour, waypoint);
              if (point) points.push(point);
            }
          } else {
            let loaded = 0;
            for (const url of context.page.waypointUrls) {
              loaded++;
              setMapStatus(modal, `Wegpunkte werden geladen... ${loaded}/${context.page.waypointUrls.length}`);
              const waypoint = await loadWaypoint(url);
              if (runId !== activeMapRun || activeMap !== map) return;
              const point = waypoint ? pointFromWaypoint(waypoint) : undefined;
              if (point) points.push({ ...point, waypoint });
            }
          }
          if (points.length === 0) {
            setMapStatus(modal, "Keine Startpunkte mit Koordinaten gefunden");
            context.log("Keine Startpunkte mit Koordinaten gefunden");
            return;
          }
          const bounds = L.latLngBounds([]);
          const markers = L.featureGroup().addTo(map);
          for (const point of points) {
            const latLng: L.LatLngExpression = [point.coordinates.lat, point.coordinates.lng];
            bounds.extend(latLng);
            L.marker(latLng, { icon: pinIcon(), title: point.title, keyboard: true })
              .addTo(markers)
              .bindPopup(popupHtml(point, context), { maxWidth: 360 });
          }
          setMapStatus(modal, `${points.length} Startpunkte`);
          requestAnimationFrame(() => {
            if (runId !== activeMapRun || activeMap !== map) return;
            map.invalidateSize();
            map.fitBounds(bounds.pad(0.15), { maxZoom: 13 });
            markers.bringToFront();
          });
          window.setTimeout(() => {
            if (runId !== activeMapRun || activeMap !== map) return;
            map.invalidateSize();
            markers.bringToFront();
          }, 250);
          context.log(`Karte: ${points.length} Startpunkte`);
        } catch (error) {
          const message = String((error as { message?: unknown } | undefined)?.message ?? error);
          setMapStatus(modal, message.includes("Extension context invalidated")
            ? "Extension wurde neu geladen. Bitte HIKR-Seite einmal neu laden."
            : "Startpunkte konnten nicht geladen werden");
          console.warn("HIKR startpoint map failed", error);
        } finally {
          if (runId === activeMapRun) {
            mapLoading = false;
            setMapButtonsLoading(false);
          }
        }
      })();
    });
  }
};
