import type { ExtensionSettings } from "./types";
import { DEFAULT_SORT } from "./sort";
import { detectLocaleFromBrowser } from "./i18n";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  language: detectLocaleFromBrowser(),
  features: {
    galleryLightbox: true,
    exploreFormRestore: true,
    searchPaginationLoader: true,
    tourDetailsEnrichment: true,
    routeTravelTimes: true,
    excelExport: true,
    hoverPreview: true,
    miniMapProfileLoader: true,
    startpointMap: true,
    siteStyles: true,
    savedLocations: true,
    hoverPreviewGallery: true,
    waypointListMapLinks: true,
    snowResearch: true
  },
  tourDetailsAutoload: {
    home: true,
    region: true,
    tourList: true,
    searchResults: true,
    waypoint: true
  },
  savedLocations: [],
  searchPresets: [],
  provider: {
    routeProvider: "ors",
    mapProvider: "osm",
    apiKeys: {},
    orsRateLimitPerMinute: 40
  },
  cache: {
    routeTtlDays: 7,
    locationClusterMeters: 2000
  },
  search: {
    extraPagesToLoad: 10,
    homePagesToLoad: 3
  },
  location: {
    preferBrowserLocation: true
  },
  ui: {
    alwaysOpenMiniMaps: true,
    waypointGmapsLinks: true,
    wideLayout: true,
    externalMapProvider: "nakarte",
    externalMapZoom: 15,
    hoverPreviewDelay: 750,
    snowHighestPeakOnly: true
  },
  dev: {
    consoleLogging: false
  },
  sort: {
    auto: false,
    key: DEFAULT_SORT.key,
    dir: DEFAULT_SORT.dir
  },
  migration: {}
};

const SETTINGS_KEY = "hikr.settings";

function mergeSettings(value?: Partial<ExtensionSettings>): ExtensionSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...value,
    features: { ...DEFAULT_SETTINGS.features, ...value?.features },
    provider: {
      ...DEFAULT_SETTINGS.provider,
      ...value?.provider,
      apiKeys: { ...DEFAULT_SETTINGS.provider.apiKeys, ...value?.provider?.apiKeys }
    },
    cache: { ...DEFAULT_SETTINGS.cache, ...value?.cache },
    search: { ...DEFAULT_SETTINGS.search, ...value?.search },
    location: { ...DEFAULT_SETTINGS.location, ...value?.location },
    ui: { ...DEFAULT_SETTINGS.ui, ...value?.ui },
    dev: { ...DEFAULT_SETTINGS.dev, ...value?.dev },
    sort: { ...DEFAULT_SETTINGS.sort, ...value?.sort },
  tourDetailsAutoload: { ...DEFAULT_SETTINGS.tourDetailsAutoload, ...value?.tourDetailsAutoload },
  savedLocations: value?.savedLocations ? [...value.savedLocations] : [...DEFAULT_SETTINGS.savedLocations],
  searchPresets: value?.searchPresets ? [...value.searchPresets] : [...DEFAULT_SETTINGS.searchPresets],
  migration: { ...DEFAULT_SETTINGS.migration, ...value?.migration }
  };
  if (merged.provider.mapProvider === "mapy" && !merged.provider.apiKeys.mapy) {
    merged.provider.mapProvider = "osm";
  }
  // One-time migration: move existing installs off the old "gmaps" default onto nakarte.
  // Only triggers for stored settings that still carry the previous default; runs once.
  if (value && !merged.migration.externalMapDefaultMigratedAt && value.ui?.externalMapProvider === "gmaps") {
    merged.ui.externalMapProvider = "nakarte";
    merged.migration.externalMapDefaultMigratedAt = Date.now();
  }
  return merged;
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return mergeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: mergeSettings(settings) });
}

export async function patchSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next = mergeSettings({
    ...current,
    ...patch,
    features: { ...current.features, ...patch.features },
    provider: {
      ...current.provider,
      ...patch.provider,
      apiKeys: { ...current.provider.apiKeys, ...patch.provider?.apiKeys }
    },
    cache: { ...current.cache, ...patch.cache },
    search: { ...current.search, ...patch.search },
    location: { ...current.location, ...patch.location },
    ui: { ...current.ui, ...patch.ui },
    dev: { ...current.dev, ...patch.dev },
    sort: { ...current.sort, ...patch.sort },
    tourDetailsAutoload: { ...current.tourDetailsAutoload, ...patch.tourDetailsAutoload },
    savedLocations: patch.savedLocations ?? current.savedLocations,
    searchPresets: patch.searchPresets ?? current.searchPresets,
    migration: { ...current.migration, ...patch.migration }
  });
  await saveSettings(next);
  return next;
}
