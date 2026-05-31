import { t } from "../../shared/i18n";
import { isAutoRoutePageType } from "../../shared/url";
import type { HikrFeature } from "../feature-types";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

export const panelFeature: HikrFeature = {
  id: "siteStyles",
  title: "HIKR Action Panel",
  defaultEnabled: true,
  matchesPage: (context) => context.isTopFrame && (context.tourUrls.length > 0 || context.pageType === "searchResults"),
  run({ root, page, settings }) {
    if (root.querySelector(".hikr-ext-panel")) return;
    // Excel / tour-details / map are listing tools — hide them on a single tour page.
    const isTour = page.pageType === "tour";
    const autoloadEnabled = page.pageType in settings.tourDetailsAutoload
      ? Boolean(settings.tourDetailsAutoload[page.pageType as keyof typeof settings.tourDetailsAutoload])
      : false;
    const detailsButton = (autoloadEnabled || isTour)
      ? ""
      : `<button class="hikr-ext-btn" data-hikr-action="enrich">${t("panel_btn_details")}</button>`;
    const savedRouteStart = localStorage.getItem("hikr.ext.route.start") ?? "";
    // The "auto travel-time" toggle only makes sense on search results and single tour
    // pages, so it is shown there only. Everywhere else the manual "Fahrtzeiten" button
    // must stay visible regardless of the persisted auto setting (otherwise the page
    // would have no routing control at all).
    const showAutoRoutes = isAutoRoutePageType(page.pageType);
    const autoRoutes = localStorage.getItem("hikr.ext.route.auto") === "true";
    const autoRoutesActive = autoRoutes && showAutoRoutes;
    const panel = document.createElement("section");
    panel.className = "hikr-ext-panel";
    panel.innerHTML = `
      <header>
        <img class="hikr-ext-panel-logo" src="${chrome.runtime.getURL("icons/hikr-logo-wide.png")}" alt="HIKR Enhancements" />
      </header>
      <main>
        <div class="hikr-ext-status">${t("panel_detected", { page: page.pageType, tours: page.tourUrls.length, waypoints: page.waypointUrls.length })}</div>
        <div class="hikr-ext-route-start">
          <label for="hikr-ext-route-start-input">${t("route_start_label")}</label>
          <div class="hikr-ext-suggest-wrap">
            <input id="hikr-ext-route-start-input" type="text" autocomplete="off" placeholder="${esc(t("route_start_placeholder"))}" value="${esc(savedRouteStart)}" />
            <button class="hikr-ext-input-clear" id="hikr-ext-route-start-clear" type="button" title="${esc(t("route_start_clear"))}" aria-label="${esc(t("route_start_clear"))}" ${savedRouteStart ? "" : "hidden"}>✕</button>
            <ul class="hikr-ext-suggest-list" id="hikr-ext-route-start-suggestions" hidden></ul>
          </div>
          <small>${t("route_start_hint")}</small>
        </div>
        ${showAutoRoutes
          ? `<label class="hikr-ext-panel-toggle">
          <input id="hikr-ext-route-auto" type="checkbox" ${autoRoutes ? "checked" : ""} />
          <span>${t("route_auto_label")}</span>
          <span class="hikr-ext-route-auto-count" id="hikr-ext-route-auto-count" aria-hidden="true" hidden></span>
          <span class="hikr-ext-route-auto-spinner" id="hikr-ext-route-auto-spinner" aria-hidden="true" hidden></span>
        </label>`
          : ""}
        <div class="hikr-ext-button-row">
          ${detailsButton}
          <button class="hikr-ext-btn" data-hikr-action="routes"${autoRoutesActive ? " hidden" : ""}>${t("panel_btn_routes")}</button>
          ${isTour ? "" : `<button class="hikr-ext-btn" data-hikr-action="map">${t("panel_btn_map")}</button>`}
          ${isTour ? "" : `<button class="hikr-ext-btn" data-hikr-action="excel">${t("panel_btn_excel")}</button>`}
          ${page.pageType === "searchResults"
            ? `<button class="hikr-ext-btn" data-hikr-action="sort">↕ Sortieren</button>`
            : ""}
          ${page.pageType === "searchResults" && settings.features.snowResearch
            ? `<button class="hikr-ext-btn" data-hikr-action="snow">❄ Schneelagen</button>`
            : ""}
        </div>
        <button class="hikr-ext-btn hikr-ext-btn-wide" data-hikr-action="options">${t("btn_options")}</button>
      </main>
    `;
    root.append(panel);
  }
};
