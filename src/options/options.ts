import { sendMessage } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { LOCALES, detectLocaleFromBrowser, setLocale, t, type Locale } from "../shared/i18n";
import type {
  ExtensionSettings,
  ExternalMapProvider,
  FeatureSettings,
  MapProviderId,
  RouteProviderId,
  SavedLocation,
  TourListPageType
} from "../shared/types";
import { UI_CSS } from "../styles/ui-css";

const FEATURE_KEYS_GENERAL: (keyof FeatureSettings)[] = [
  "galleryLightbox",
  "exploreFormRestore",
  "searchPaginationLoader",
  "excelExport",
  "hoverPreview",
  "hoverPreviewGallery",
  "waypointListMapLinks",
  "siteStyles",
  "savedLocations"
];

const FEATURE_KEYS_TOURDETAILS: (keyof FeatureSettings)[] = [
  "tourDetailsEnrichment",
  "routeTravelTimes",
  "miniMapProfileLoader",
  "startpointMap"
];

const AUTOLOAD_KEYS: TourListPageType[] = ["home", "region", "tourList", "searchResults", "waypoint"];

type NavSection = "features" | "provider" | "saved_locations" | "tourdetails" | "autoload" | "cache_location" | "search" | "diagnose";

const NAV_SECTIONS: NavSection[] = [
  "features", "provider", "saved_locations", "tourdetails",
  "autoload", "cache_location", "search", "diagnose"
];

interface CacheStatsData {
  tours: number;
  waypoints: number;
  routes: number;
  bytesInUse: number;
}

function navLabel(section: NavSection): string {
  const map: Record<NavSection, string> = {
    features: t("section_features"),
    provider: t("section_provider"),
    saved_locations: t("section_saved_locations"),
    tourdetails: t("section_tourdetails"),
    autoload: t("section_autoload"),
    cache_location: t("section_cache_location"),
    search: t("section_search"),
    diagnose: t("section_diagnose")
  };
  return map[section];
}

function css() {
  const style = document.createElement("style");
  style.textContent = UI_CSS;
  document.head.append(style);
}

function inputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
}

function checked(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement).checked;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function parseCoords(raw: string): string | undefined {
  const cleaned = raw.replace(/[°NSEW\s]+/gi, " ").trim();
  const match = cleaned.match(/^(-?\d+(?:[.,]\d+)?)[\s,;]+(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return undefined;
  const lat = Number(match[1].replace(",", "."));
  const lng = Number(match[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return `${lat},${lng}`;
}

function newLocationId(): string {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function verifyMapyKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false;
  const url = `https://api.mapy.com/v1/maptiles/outdoor/256/0/0/0?apikey=${encodeURIComponent(apiKey.trim())}`;
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function formatDelay(ms: number): string {
  if (ms <= 0) return t("label_hover_delay_instant");
  return `${(ms / 1000).toFixed(2).replace(/\.?0+$/, "")} s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function loadCacheStats(): Promise<CacheStatsData> {
  const { stats } = await sendMessage<{ stats: { tours: number; waypoints: number; routes: number } }>({ type: "GET_CACHE_STATS" });
  let bytesInUse = 0;
  try {
    const estimate = await navigator.storage.estimate();
    bytesInUse = estimate.usage ?? 0;
  } catch { /* ignore */ }
  return { ...stats, bytesInUse };
}

function cacheStatsHtml(stats: CacheStatsData): string {
  return `
    <div class="cache-stat-grid">
      <span>${esc(t("cache_stats", { tours: stats.tours, waypoints: stats.waypoints, routes: stats.routes }))}</span>
      <span class="muted">${stats.bytesInUse > 0 ? `ca. ${formatBytes(stats.bytesInUse)}` : ""}</span>
    </div>
  `;
}

function renderSavedLocations(settings: ExtensionSettings): string {
  const sorted = [...settings.savedLocations].sort((a, b) => a.name.localeCompare(b.name));
  const list = sorted.length === 0
    ? `<p class="muted">${esc(t("saved_location_no_entries"))}</p>`
    : sorted.map((entry) => `
        <div class="saved-location-row" data-id="${esc(entry.id)}" data-mode="view">
          <div class="saved-location-view">
            <strong>${esc(entry.name)}</strong>
            <span class="muted">${esc(entry.coordinates)}</span>
          </div>
          <div class="saved-location-edit" hidden>
            <input type="text" data-edit-name placeholder="${esc(t("saved_location_name_placeholder"))}" value="${esc(entry.name)}" />
            <input type="text" data-edit-coords placeholder="${esc(t("saved_location_coords_placeholder"))}" value="${esc(entry.coordinates)}" />
          </div>
          <div class="saved-location-actions">
            <button type="button" data-edit-location="${esc(entry.id)}">${esc(t("saved_location_edit"))}</button>
            <button type="button" data-save-location="${esc(entry.id)}" hidden>${esc(t("saved_location_save_changes"))}</button>
            <button type="button" data-cancel-location="${esc(entry.id)}" hidden>${esc(t("saved_location_cancel"))}</button>
            <button type="button" data-delete-location="${esc(entry.id)}">${esc(t("saved_location_delete"))}</button>
          </div>
        </div>
      `).join("");
  return `
    <p class="muted">${esc(t("section_saved_locations_hint"))}</p>
    <div class="saved-location-add">
      <div class="opt-suggest-wrap">
        <input type="text" id="newLocName" placeholder="${esc(t("saved_location_name_placeholder"))}" autocomplete="off" />
        <ul class="opt-suggest-list" id="locNameSuggestions" hidden></ul>
      </div>
      <input type="text" id="newLocCoords" placeholder="${esc(t("saved_location_coords_placeholder"))}" />
      <button type="button" class="btn" id="addLocation">${esc(t("saved_location_add"))}</button>
    </div>
    <div class="saved-location-list">${list}</div>
  `;
}

function renderAllPanels(settings: ExtensionSettings, activeSection: NavSection): string {
  const languageOptions = LOCALES.map(
    (e) => `<option value="${e.value}" ${settings.language === e.value ? "selected" : ""}>${e.label}</option>`
  ).join("");

  const featureToggles = (keys: (keyof FeatureSettings)[]) =>
    keys.map((key) => `
      <div class="toggle">
        <input id="feature-${key}" type="checkbox" ${settings.features[key] ? "checked" : ""} />
        <div>
          <label for="feature-${key}">${esc(t(`feature_${key}_title`))}</label>
          <small>${esc(t(`feature_${key}_desc`))}</small>
        </div>
      </div>
    `).join("");

  const autoloadToggles = AUTOLOAD_KEYS.map((key) => `
    <div class="toggle">
      <input id="autoload-${key}" type="checkbox" ${settings.tourDetailsAutoload[key] ? "checked" : ""} />
      <div><label for="autoload-${key}">${esc(t(`autoload_${key}`))}</label></div>
    </div>
  `).join("");

  const clusterKm = (settings.cache.locationClusterMeters / 1000).toFixed(1);

  const sections: Record<NavSection, string> = {
    features: featureToggles(FEATURE_KEYS_GENERAL),

    provider: `
      <div class="field">
        <label for="routeProvider">${esc(t("label_route_provider"))}</label>
        <select id="routeProvider">
          <option value="ors" ${settings.provider.routeProvider === "ors" ? "selected" : ""}>OpenRouteService</option>
          <option value="google" ${settings.provider.routeProvider === "google" ? "selected" : ""}>Google Routes</option>
        </select>
      </div>
      <div class="field">
        <label for="mapProvider">${esc(t("label_map_provider"))}</label>
        <select id="mapProvider">
          <option value="osm" ${settings.provider.mapProvider === "osm" ? "selected" : ""}>OSM Standard</option>
          <option value="mapy" ${settings.provider.mapProvider === "mapy" ? "selected" : ""}>Mapy.com</option>
        </select>
      </div>
      <div class="field">
        <label for="orsKey">${esc(t("label_ors_key"))}</label>
        <input id="orsKey" type="password" autocomplete="off" value="${esc(settings.provider.apiKeys.ors ?? "")}" />
      </div>
      <div class="field">
        <label for="googleKey">${esc(t("label_google_key"))}</label>
        <input id="googleKey" type="password" autocomplete="off" value="${esc(settings.provider.apiKeys.google ?? "")}" />
      </div>
      <div class="field">
        <label for="mapyKey">${esc(t("label_mapy_key"))}</label>
        <input id="mapyKey" type="password" autocomplete="off" value="${esc(settings.provider.apiKeys.mapy ?? "")}" />
        <small id="mapyStatus">${esc(t("mapy_default"))}</small>
        <div class="actions">
          <button class="btn secondary" id="verifyMapy" type="button">${esc(t("label_verify_mapy"))}</button>
        </div>
      </div>
    `,

    saved_locations: renderSavedLocations(settings),

    tourdetails: `
      ${featureToggles(FEATURE_KEYS_TOURDETAILS)}
      <div class="field">
        <label for="hoverDelay">${esc(t("label_hover_delay"))} — <span id="hoverDelayValue">${formatDelay(settings.ui.hoverPreviewDelay)}</span></label>
        <input id="hoverDelay" type="range" min="0" max="3000" step="250" value="${settings.ui.hoverPreviewDelay ?? 2000}" style="width:100%;accent-color:var(--accent)" />
        <small>${esc(t("label_hover_delay_hint"))}</small>
      </div>
      <div class="toggle">
        <input id="alwaysOpenMiniMaps" type="checkbox" ${settings.ui.alwaysOpenMiniMaps ? "checked" : ""} />
        <div>
          <label for="alwaysOpenMiniMaps">${esc(t("label_always_open_minimaps"))}</label>
          <small>${esc(t("label_always_open_minimaps_hint"))}</small>
        </div>
      </div>
      <div class="toggle">
        <input id="waypointGmapsLinks" type="checkbox" ${settings.ui.waypointGmapsLinks ? "checked" : ""} />
        <div>
          <label for="waypointGmapsLinks">${esc(t("label_waypoint_gmaps"))}</label>
          <small>${esc(t("label_waypoint_gmaps_hint"))}</small>
        </div>
      </div>
      <div class="field">
        <label for="externalMapProvider">${esc(t("label_external_map_provider"))}</label>
        <select id="externalMapProvider">
          <option value="nakarte" ${settings.ui.externalMapProvider === "nakarte" ? "selected" : ""}>nakarte.me</option>
          <option value="ppete" ${settings.ui.externalMapProvider === "ppete" ? "selected" : ""}>ppete (Hybrid map)</option>
          <option value="gmaps" ${settings.ui.externalMapProvider === "gmaps" ? "selected" : ""}>Google Maps</option>
          <option value="osm" ${settings.ui.externalMapProvider === "osm" ? "selected" : ""}>OpenStreetMap</option>
          <option value="openTopoMap" ${settings.ui.externalMapProvider === "openTopoMap" ? "selected" : ""}>OpenTopoMap</option>
          <option value="mapy" ${settings.ui.externalMapProvider === "mapy" ? "selected" : ""}>Mapy.cz</option>
          <option value="swisstopo" ${settings.ui.externalMapProvider === "swisstopo" ? "selected" : ""}>swisstopo</option>
          <option value="bergfex" ${settings.ui.externalMapProvider === "bergfex" ? "selected" : ""}>BergFex</option>
          <option value="custom" ${settings.ui.externalMapProvider === "custom" ? "selected" : ""}>Custom</option>
        </select>
        <small>${esc(t("label_external_map_provider_hint"))}</small>
      </div>
      <div class="field">
        <label for="externalMapZoom">${esc(t("label_external_map_zoom"))}</label>
        <input id="externalMapZoom" type="number" min="3" max="19" value="${settings.ui.externalMapZoom ?? 15}" />
      </div>
      <div class="field">
        <label for="externalMapCustom">${esc(t("label_external_map_custom"))}</label>
        <input id="externalMapCustom" type="text" placeholder="https://example.com/?lat={lat}&amp;lng={lng}&amp;z={zoom}" value="${esc(settings.ui.externalMapCustomTemplate ?? "")}" />
        <small>${esc(t("label_external_map_custom_hint"))}</small>
      </div>
    `,

    autoload: `
      <p class="muted">${esc(t("section_autoload_hint"))}</p>
      ${autoloadToggles}
    `,

    cache_location: `
      <div class="field">
        <label for="routeTtlDays">${esc(t("label_route_ttl"))}</label>
        <input id="routeTtlDays" type="number" min="1" max="90" value="${settings.cache.routeTtlDays}" />
        <div class="actions" style="margin-top:8px">
          <button class="btn secondary" id="clearRoutes" type="button">${esc(t("label_clear_routes"))}</button>
        </div>
      </div>
      <div class="field">
        <label for="clusterKm">${esc(t("label_cluster"))}</label>
        <input id="clusterKm" type="number" min="0.1" max="20" step="0.5" value="${clusterKm}" />
        <small>${esc(t("label_cluster_hint"))}</small>
      </div>
      <div class="field">
        <label for="fallbackStart">${esc(t("label_fallback_start"))}</label>
        <input id="fallbackStart" placeholder="47.654619,10.364131" value="${settings.location.fallbackStart ? `${settings.location.fallbackStart.lat},${settings.location.fallbackStart.lng}` : ""}" />
      </div>
      <div class="toggle">
        <input id="preferBrowserLocation" type="checkbox" ${settings.location.preferBrowserLocation ? "checked" : ""} />
        <div>
          <label for="preferBrowserLocation">${esc(t("label_prefer_browser"))}</label>
          <small>${esc(t("label_prefer_browser_hint"))}</small>
        </div>
      </div>
      <div class="cache-stats-section">
        <h3>${esc(t("label_cache_status"))}</h3>
        <div id="cacheStatsBlock" class="muted">${esc(t("cache_stats_placeholder"))}</div>
        <div class="actions" style="margin-top:8px">
          <button class="btn secondary" id="clearCacheLocal" type="button">${esc(t("btn_clear_cache"))}</button>
        </div>
        <p class="status" id="cacheLocalStatus"></p>
      </div>
    `,

    search: `
      <div class="field">
        <label for="language">${esc(t("label_language"))}</label>
        <select id="language">${languageOptions}</select>
      </div>
      <div class="toggle">
        <input id="wideLayout" type="checkbox" ${settings.ui.wideLayout ? "checked" : ""} />
        <div>
          <label for="wideLayout">${esc(t("label_wide_layout"))}</label>
          <small>${esc(t("label_wide_layout_hint"))}</small>
        </div>
      </div>
      <div class="field">
        <label for="extraPages">${esc(t("label_extra_pages"))}</label>
        <input id="extraPages" type="number" min="0" max="20" value="${settings.search.extraPagesToLoad}" />
      </div>
      <div class="field">
        <label for="homePages">${esc(t("label_home_pages"))}</label>
        <input id="homePages" type="number" min="1" max="20" value="${settings.search.homePagesToLoad}" />
        <small>${esc(t("label_home_pages_hint"))}</small>
      </div>
      <h3 style="margin:20px 0 8px;font-size:13px;color:var(--muted)">❄ Schneelagenrecherche</h3>
      <div class="toggle">
        <input id="snowHighestPeakOnly" type="checkbox" ${settings.ui.snowHighestPeakOnly ? "checked" : ""} />
        <div>
          <label for="snowHighestPeakOnly">Nur höchsten Gipfel pro Bild anzeigen</label>
          <small>Ein Bild mit mehreren annotierten Gipfeln erscheint nur einmal – beim höchsten.</small>
        </div>
      </div>
    `,

    diagnose: `
      <div class="toggle">
        <input id="devLogging" type="checkbox" ${settings.dev?.consoleLogging ? "checked" : ""} />
        <div>
          <label for="devLogging">${esc(t("label_dev_logging"))}</label>
          <small>${esc(t("label_dev_logging_hint"))}</small>
        </div>
      </div>
      <div class="actions" style="margin-top:18px">
        <button class="btn" id="save">${esc(t("btn_save"))}</button>
      </div>
      <p class="status" id="status"></p>
    `
  };

  return NAV_SECTIONS.map((section) => `
    <div class="panel-section" data-panel="${section}"${section !== activeSection ? ' hidden' : ''}>
      <h2 class="panel-title">${esc(navLabel(section))}</h2>
      ${sections[section]}
    </div>
  `).join("");
}

function render(settings: ExtensionSettings, activeSection: NavSection) {
  const app = document.querySelector("#app")!;

  const navItems = NAV_SECTIONS.map((section) => `
    <button class="nav-item${section === activeSection ? " active" : ""}" data-nav="${section}" type="button">
      ${esc(navLabel(section))}
    </button>
  `).join("");

  app.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <img class="hero-logo-wide" src="${chrome.runtime.getURL("icons/hikr-logo-wide.png")}" alt="HIKR Enhancements" />
        <p class="hero-tagline">${esc(t("extension_tagline"))}</p>
      </header>
      <div class="options-layout">
        <nav class="options-sidebar">${navItems}</nav>
        <main class="options-main">${renderAllPanels(settings, activeSection)}</main>
      </div>
    </div>
  `;
}

function readSettings(current: ExtensionSettings): ExtensionSettings {
  const features = { ...current.features };
  for (const key of [...FEATURE_KEYS_GENERAL, ...FEATURE_KEYS_TOURDETAILS]) {
    features[key] = checked(`feature-${key}`);
  }
  const autoload = { ...current.tourDetailsAutoload };
  for (const key of AUTOLOAD_KEYS) autoload[key] = checked(`autoload-${key}`);
  const fallback = inputValue("fallbackStart").split(",").map(Number);
  return {
    ...current,
    language: inputValue("language") as Locale,
    features,
    tourDetailsAutoload: autoload,
    provider: {
      ...current.provider,
      routeProvider: inputValue("routeProvider") as RouteProviderId,
      mapProvider: inputValue("mapProvider") as MapProviderId,
      apiKeys: {
        ors: inputValue("orsKey") || undefined,
        google: inputValue("googleKey") || undefined,
        mapy: inputValue("mapyKey") || undefined
      }
    },
    cache: {
      routeTtlDays: Number(inputValue("routeTtlDays")) || DEFAULT_SETTINGS.cache.routeTtlDays,
      locationClusterMeters: Math.round((Number(inputValue("clusterKm")) || DEFAULT_SETTINGS.cache.locationClusterMeters / 1000) * 1000)
    },
    search: {
      extraPagesToLoad: Number(inputValue("extraPages")) || 0,
      homePagesToLoad: Math.max(1, Number(inputValue("homePages")) || DEFAULT_SETTINGS.search.homePagesToLoad)
    },
    location: {
      preferBrowserLocation: checked("preferBrowserLocation"),
      fallbackStart: fallback.length >= 2 && Number.isFinite(fallback[0]) && Number.isFinite(fallback[1]) ? { lat: fallback[0], lng: fallback[1] } : undefined
    },
    ui: {
      alwaysOpenMiniMaps: checked("alwaysOpenMiniMaps"),
      waypointGmapsLinks: checked("waypointGmapsLinks"),
      wideLayout: checked("wideLayout"),
      externalMapProvider: (inputValue("externalMapProvider") as ExternalMapProvider) || "gmaps",
      externalMapZoom: Number(inputValue("externalMapZoom")) || 15,
      externalMapCustomTemplate: inputValue("externalMapCustom").trim() || undefined,
      hoverPreviewDelay: Number(inputValue("hoverDelay")) || 0,
      snowHighestPeakOnly: checked("snowHighestPeakOnly")
    },
    dev: {
      consoleLogging: checked("devLogging")
    }
  };
}

async function readSettingsWithMapValidation(current: ExtensionSettings): Promise<ExtensionSettings> {
  const next = readSettings(current);
  if (next.provider.mapProvider !== "mapy") return next;
  const ok = await verifyMapyKey(next.provider.apiKeys.mapy ?? "");
  if (ok) return next;
  return { ...next, provider: { ...next.provider, mapProvider: "osm" } };
}

function getActiveSection(): NavSection {
  try {
    const stored = localStorage.getItem("hikr.options.tab") as NavSection | null;
    if (stored && NAV_SECTIONS.includes(stored)) return stored;
  } catch { /* ignore */ }
  return "features";
}

function setActiveSection(section: NavSection) {
  try { localStorage.setItem("hikr.options.tab", section); } catch { /* ignore */ }
}

function switchSection(next: NavSection, current: NavSection) {
  document.querySelector<HTMLElement>(`[data-nav="${current}"]`)?.classList.remove("active");
  document.querySelector<HTMLElement>(`[data-panel="${current}"]`)?.setAttribute("hidden", "");
  document.querySelector<HTMLElement>(`[data-nav="${next}"]`)?.classList.add("active");
  document.querySelector<HTMLElement>(`[data-panel="${next}"]`)?.removeAttribute("hidden");
}

async function refreshCacheStats() {
  const stats = await loadCacheStats();
  const block = document.getElementById("cacheStatsBlock");
  if (block) block.innerHTML = cacheStatsHtml(stats);
}

function setRowMode(row: HTMLElement, mode: "view" | "edit") {
  row.dataset.mode = mode;
  const editing = mode === "edit";
  row.querySelector<HTMLElement>(".saved-location-view")?.toggleAttribute("hidden", editing);
  row.querySelector<HTMLElement>(".saved-location-edit")?.toggleAttribute("hidden", !editing);
  row.querySelector<HTMLElement>("[data-edit-location]")?.toggleAttribute("hidden", editing);
  row.querySelector<HTMLElement>("[data-save-location]")?.toggleAttribute("hidden", !editing);
  row.querySelector<HTMLElement>("[data-cancel-location]")?.toggleAttribute("hidden", !editing);
  row.querySelector<HTMLElement>("[data-delete-location]")?.toggleAttribute("hidden", editing);
}

async function boot() {
  css();
  let { settings } = await sendMessage<{ settings: ExtensionSettings }>({ type: "GET_SETTINGS" });
  setLocale(settings.language ?? detectLocaleFromBrowser());
  let activeSection = getActiveSection();
  render(settings, activeSection);
  void refreshCacheStats();

  let autosaveTimer: number | undefined;

  function flashStatus(id: string, message: string) {
    const el = document.querySelector<HTMLElement>(`#${id}`);
    if (!el) return;
    el.textContent = message;
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => { el.textContent = ""; }, 1600);
  }

  async function autosave(rerender: boolean) {
    try {
      settings = readSettings(settings);
      await sendMessage({ type: "SAVE_SETTINGS", settings });
      flashStatus("status", t("btn_save") + " ✓");
      if (rerender) {
        render(settings, activeSection);
        void refreshCacheStats();
      }
    } catch (error) {
      console.warn("HIKR autosave failed", error);
    }
  }

  let locSuggestTimer: number | undefined;
  let locSuggestSeq = 0;

  function hidLocSuggestions() {
    const list = document.getElementById("locNameSuggestions");
    if (list) { list.setAttribute("hidden", ""); list.innerHTML = ""; }
  }

  document.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target.id !== "newLocName") return;
    const input = target as HTMLInputElement;
    window.clearTimeout(locSuggestTimer);
    const query = input.value.trim();
    if (query.length < 3) { hidLocSuggestions(); return; }
    const seq = ++locSuggestSeq;
    locSuggestTimer = window.setTimeout(async () => {
      try {
        const response = await sendMessage({ type: "GEOCODE_SUGGESTIONS", query });
        if (seq !== locSuggestSeq) return;
        const geocodes = "geocodes" in response ? response.geocodes : [];
        const list = document.getElementById("locNameSuggestions");
        if (!list) return;
        if (geocodes.length === 0) { hidLocSuggestions(); return; }
        list.innerHTML = geocodes.map((item) =>
          `<li><button type="button" data-name="${esc(item.displayName)}" data-lat="${item.coordinates.lat}" data-lng="${item.coordinates.lng}">${esc(item.displayName)}</button></li>`
        ).join("");
        list.removeAttribute("hidden");
      } catch { hidLocSuggestions(); }
    }, 600);
  });

  document.addEventListener("click", (event) => {
    const suggestBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("#locNameSuggestions button[data-name]");
    if (suggestBtn) {
      event.preventDefault();
      const nameInput = document.getElementById("newLocName") as HTMLInputElement | null;
      const coordsInput = document.getElementById("newLocCoords") as HTMLInputElement | null;
      if (nameInput) nameInput.value = suggestBtn.dataset.name ?? "";
      if (coordsInput) coordsInput.value = `${suggestBtn.dataset.lat},${suggestBtn.dataset.lng}`;
      hidLocSuggestions();
      return;
    }
    if (!(event.target as HTMLElement).closest("#newLocName, #locNameSuggestions")) hidLocSuggestions();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hidLocSuggestions();
  });

  document.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (target.closest(".saved-location-edit, .saved-location-add")) return;
    if (target.id === "language") {
      setLocale((target as HTMLSelectElement).value as Locale);
      void autosave(true);
      return;
    }
    if (target.matches("input, select")) void autosave(false);
  });

  document.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (target.closest(".saved-location-edit, .saved-location-add")) return;
    if (target.id === "hoverDelay") {
      const display = document.getElementById("hoverDelayValue");
      if (display) display.textContent = formatDelay(Number((target as HTMLInputElement).value));
      window.clearTimeout(autosaveTimer);
      autosaveTimer = window.setTimeout(() => void autosave(false), 300);
      return;
    }
    if (target.matches('input[type="number"], input[type="password"], input[type="text"]:not([data-edit-name]):not([data-edit-coords]):not(#newLocName):not(#newLocCoords)')) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = window.setTimeout(() => void autosave(false), 500);
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    const navEl = target.closest<HTMLElement>("[data-nav]");
    if (navEl?.dataset.nav) {
      const next = navEl.dataset.nav as NavSection;
      if (next !== activeSection) {
        switchSection(next, activeSection);
        activeSection = next;
        setActiveSection(activeSection);
      }
      return;
    }

    if (target.id === "verifyMapy") {
      const statusEl = document.querySelector("#mapyStatus")!;
      statusEl.textContent = t("mapy_checking");
      const ok = await verifyMapyKey(inputValue("mapyKey"));
      statusEl.textContent = ok ? t("mapy_valid") : t("mapy_invalid");
      if (!ok) (document.getElementById("mapProvider") as HTMLSelectElement).value = "osm";
      return;
    }
    if (target.id === "save") {
      settings = await readSettingsWithMapValidation(settings);
      await sendMessage({ type: "SAVE_SETTINGS", settings });
      flashStatus("status", settings.provider.mapProvider === "mapy" ? t("saved_mapy_ok") : t("saved_osm"));
      void refreshCacheStats();
      return;
    }
    if (target.id === "clearCacheLocal") {
      await sendMessage({ type: "CLEAR_CACHE" });
      flashStatus("cacheLocalStatus", t("btn_clear_cache") + " ✓");
      void refreshCacheStats();
      return;
    }
    if (target.id === "clearRoutes") {
      await sendMessage({ type: "CLEAR_ROUTES" });
      flashStatus("cacheLocalStatus", t("label_clear_routes") + " ✓");
      void refreshCacheStats();
      return;
    }

    const deleteId = target.getAttribute("data-delete-location");
    if (deleteId) {
      const removed = settings.savedLocations.find((e) => e.id === deleteId);
      if (!removed) return;
      if (!confirm(t("saved_location_confirm_delete", { name: removed.name }))) return;
      const next = settings.savedLocations.filter((e) => e.id !== deleteId);
      const response = await sendMessage<{ settings: ExtensionSettings }>({ type: "SAVE_SAVED_LOCATIONS", savedLocations: next as SavedLocation[] });
      settings = response.settings;
      render(settings, activeSection);
      void refreshCacheStats();
      return;
    }
    const editId = target.getAttribute("data-edit-location");
    if (editId) {
      const row = document.querySelector<HTMLElement>(`.saved-location-row[data-id="${CSS.escape(editId)}"]`);
      if (row) setRowMode(row, "edit");
      return;
    }
    const cancelId = target.getAttribute("data-cancel-location");
    if (cancelId) {
      const row = document.querySelector<HTMLElement>(`.saved-location-row[data-id="${CSS.escape(cancelId)}"]`);
      if (row) setRowMode(row, "view");
      return;
    }
    const saveId = target.getAttribute("data-save-location");
    if (saveId) {
      const row = document.querySelector<HTMLElement>(`.saved-location-row[data-id="${CSS.escape(saveId)}"]`);
      if (!row) return;
      const name = row.querySelector<HTMLInputElement>("[data-edit-name]")!.value.trim();
      const coords = row.querySelector<HTMLInputElement>("[data-edit-coords]")!.value;
      if (!name) { alert(t("saved_location_name_required")); return; }
      const normalized = parseCoords(coords);
      if (!normalized) { alert(t("saved_location_invalid")); return; }
      const duplicate = settings.savedLocations.find((e) => e.id !== saveId && e.name.toLowerCase() === name.toLowerCase());
      if (duplicate) { alert(t("saved_location_duplicate_name", { name })); return; }
      const next = settings.savedLocations.map((e) => e.id === saveId ? { ...e, name, coordinates: normalized } : e);
      const response = await sendMessage<{ settings: ExtensionSettings }>({ type: "SAVE_SAVED_LOCATIONS", savedLocations: next as SavedLocation[] });
      settings = response.settings;
      render(settings, activeSection);
      void refreshCacheStats();
      return;
    }
    if (target.id === "addLocation") {
      const nameInput = document.getElementById("newLocName") as HTMLInputElement;
      const coordsInput = document.getElementById("newLocCoords") as HTMLInputElement;
      const name = nameInput.value.trim();
      const coords = coordsInput.value;
      if (!name) { alert(t("saved_location_name_required")); nameInput.focus(); return; }
      const normalized = parseCoords(coords);
      if (!normalized) { alert(t("saved_location_invalid")); coordsInput.focus(); return; }
      const duplicate = settings.savedLocations.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (duplicate) { alert(t("saved_location_duplicate_name", { name })); nameInput.focus(); return; }
      const entry: SavedLocation = { id: newLocationId(), name, coordinates: normalized, createdAt: Date.now() };
      const response = await sendMessage<{ settings: ExtensionSettings }>({ type: "SAVE_SAVED_LOCATIONS", savedLocations: [...settings.savedLocations, entry] });
      settings = response.settings;
      render(settings, activeSection);
      void refreshCacheStats();
      return;
    }
  });
}

void boot();
