import { externalMapUrl } from "../shared/external-map";
import { t } from "../shared/i18n";
import type { Coordinates, ExtensionSettings, TourCacheRecord, WaypointCacheRecord } from "../shared/types";

export function ensureRoot(): HTMLElement {
  let root = document.querySelector<HTMLElement>("#hikr-ext-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "hikr-ext-root";
    document.body.append(root);
  }
  return root;
}

export function injectStyle(css: string, id = "hikr-ext-style"): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.documentElement.append(style);
}

function tourUrlMatches(href: string, url: string): boolean {
  return href.replace(/\/$/, "") === url.replace(/\/$/, "");
}

export function findTourContainer(url: string): HTMLElement | undefined {
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((item) => tourUrlMatches(item.href, url));
  // Prefer text links over image-only links so we land in the right cell/container
  const anchor = anchors.find((item) => Boolean(item.textContent?.trim())) ?? anchors[0];
  if (!anchor) return undefined;
  const card = anchor.closest<HTMLElement>(".content-list") ?? undefined;
  return card ?? anchor.parentElement ?? undefined;
}

function findTourHeadline(url: string, scope: ParentNode = document): HTMLAnchorElement | undefined {
  const candidates = [...scope.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((item) => tourUrlMatches(item.href, url));
  // Prefer links with visible text over image-only links (e.g. thumbnail anchors)
  return candidates.find((item) => Boolean(item.textContent?.trim())) ?? candidates[0];
}

function tourDetailsInsertionTarget(anchor: HTMLAnchorElement): HTMLElement {
  const description = anchor.parentElement?.querySelector<HTMLElement>(".content-list-intern_div");
  if (description) return description;
  const strong = anchor.closest("strong");
  return strong instanceof HTMLElement ? strong : anchor;
}

export function ensureTourPlaceholder(parent: HTMLElement, tourUrl: string): HTMLElement {
  let placeholder = parent.querySelector<HTMLElement>(`.hikr-ext-tour-details[data-tour-url="${CSS.escape(tourUrl)}"]`);
  if (placeholder) return placeholder;
  const anchor = findTourHeadline(tourUrl, parent);
  const inline = !parent.classList.contains("content-list");
  placeholder = document.createElement(inline ? "span" : "div");
  placeholder.className = `hikr-ext-tour-details hikr-ext-tour-pending${inline ? " hikr-ext-tour-inline" : ""}`;
  placeholder.dataset.tourUrl = tourUrl;
  if (!inline) placeholder.innerHTML = '<span class="hikr-ext-skeleton" aria-hidden="true"></span>';
  if (anchor) {
    const target = tourDetailsInsertionTarget(anchor);
    if (target.classList.contains("content-list-intern_div")) target.insertAdjacentElement("beforebegin", placeholder);
    else target.insertAdjacentElement("afterend", placeholder);
  }
  else parent.prepend(placeholder);
  return placeholder;
}

export function appendOnce(parent: HTMLElement, className: string, html: string): HTMLElement {
  const existing = parent.querySelector<HTMLElement>(`.${className}`);
  if (existing) return existing;
  const wrapper = document.createElement("div");
  wrapper.className = className;
  wrapper.innerHTML = html;
  parent.append(wrapper);
  return wrapper;
}

export function getBrowserLocation(): Promise<Coordinates | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(undefined),
      { maximumAge: 10 * 60 * 1000, timeout: 5000 }
    );
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function ellipsize(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;
}

const ICO_UP = "↗";
const ICO_DOWN = "↘";
const ICO_TRAIL = "↔";
const ICO_CLOCK = "⌚";
const ICO_PEAK = "▲";

export function detailHtml(tour: TourCacheRecord, waypoint?: WaypointCacheRecord, settings?: ExtensionSettings, compact = false): string {
  const parts: string[] = [];
  if (tour.tourDuration) parts.push(`<span title="Zeitbedarf">${ICO_CLOCK} ${escapeHtml(tour.tourDuration)}</span>`);
  if (tour.heightGain) parts.push(`<span title="Aufstieg">${ICO_UP} ${escapeHtml(tour.heightGain)}</span>`);
  if (tour.heightLoss) parts.push(`<span title="Abstieg">${ICO_DOWN} ${escapeHtml(tour.heightLoss)}</span>`);
  if (tour.routeLength) {
    parts.push(`<span title="Strecke: ${escapeHtml(tour.routeLength)}">${ICO_TRAIL} ${escapeHtml(ellipsize(tour.routeLength, 30))}</span>`);
  }
  if (tour.maxElevation) parts.push(`<span title="Maximale Höhe">${ICO_PEAK} ${tour.maxElevation} m</span>`);
  if (tour.startWaypointName && tour.startWaypointName === tour.endWaypointName) {
    parts.push(`<span>${t("btn_round_trip")}</span>`);
  }
  if (!compact && waypoint?.coordinates && settings) {
    const map = externalMapUrl(waypoint.coordinates, settings);
    const label = waypoint.name ?? tour.startWaypointName ?? "Start";
    parts.push(
      `<a class="hikr-ext-link hikr-ext-external-map-link" href="${map.href}" target="_blank" rel="noopener noreferrer" title="In ${map.label} öffnen">📍 ${escapeHtml(label)}</a>`
    );
  }
  if (compact) {
    const statsLine = parts.length > 0
      ? `<span class="hikr-ext-stats">${parts.join(' <span class="hikr-ext-sep">·</span> ')}</span>`
      : "";
    return statsLine;
  }
  for (const link of tour.geodataLinks) {
    const encodedUrl = encodeURIComponent(link.url);
    const encodedOptions = encodeURIComponent(JSON.stringify({ files: [link.url], theme: "light" }));
    const nakarteUrl = `https://nakarte.me/#nktu=${encodedUrl}&autoprofile`;
    const gpxStudioUrl = `https://gpx.studio/embed?options=${encodedOptions}`;
    const fmt = link.format.toUpperCase();
    const extra = link.format === "gpx"
      ? ` · <a class="hikr-ext-link" href="${gpxStudioUrl}" target="_blank" rel="noopener noreferrer">gpx.studio</a>`
      : "";
    parts.push(
      `<span title="${escapeHtml(link.label)}">⌁ <a class="hikr-ext-link" href="${link.url}" target="_blank" rel="noopener noreferrer">${fmt}</a> · <a class="hikr-ext-link" href="${nakarteUrl}" target="_blank" rel="noopener noreferrer">nakarte</a>${extra}</span>`
    );
  }
  const statsLine = parts.length > 0
    ? `<span class="hikr-ext-stats">${parts.join(' <span class="hikr-ext-sep">·</span> ')}</span>`
    : "";

  const waypointList = tour.waypoints.length > 0
    ? `<details class="hikr-ext-waypoint-list">
        <summary>${t("waypoints_label")} (${tour.waypoints.length})</summary>
        <ol>
          ${tour.waypoints.map((entry) => {
            const elev = entry.elevation ? ` ${entry.elevation} m` : "";
            const visits = entry.visits ? ` <span class="hikr-ext-wp-visits">(${entry.visits})</span>` : "";
            const inner = `${escapeHtml(entry.name)}${elev}`;
            const link = entry.url
              ? `<a class="hikr-ext-link" href="${entry.url}" target="_blank" rel="noopener noreferrer">${inner}</a>`
              : inner;
            const attrs = entry.url ? ` data-hikr-waypoint-url="${escapeHtml(entry.url)}"` : "";
            const mapSlot = entry.url ? ` <span class="hikr-ext-waypoint-map-slot" aria-live="polite"></span>` : "";
            return `<li${attrs}>${link}${visits}${mapSlot}</li>`;
          }).join("")}
        </ol>
      </details>`
    : "";

  return `${statsLine}${waypointList}`;
}
