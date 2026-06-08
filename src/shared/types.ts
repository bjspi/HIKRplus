export type PageType =
  | "hikr"
  | "home"
  | "region"
  | "tourList"
  | "explore"
  | "searchResults"
  | "tour"
  | "waypoint"
  | "gallery"
  | "unknown";

export type TourListPageType = "home" | "region" | "tourList" | "searchResults" | "waypoint";

export type RouteProviderId = "ors" | "google";
export type MapProviderId = "mapy" | "osm";
export type TravelMode = "driving-car";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PageContext {
  url: string;
  pageType: PageType;
  isTopFrame: boolean;
  tourUrls: string[];
  waypointUrls: string[];
  hasListings: boolean;
  hasGallery: boolean;
  hasExploreForm: boolean;
}

export interface FeatureSettings {
  galleryLightbox: boolean;
  exploreFormRestore: boolean;
  searchPaginationLoader: boolean;
  tourDetailsEnrichment: boolean;
  routeTravelTimes: boolean;
  excelExport: boolean;
  hoverPreview: boolean;
  miniMapProfileLoader: boolean;
  startpointMap: boolean;
  siteStyles: boolean;
  savedLocations: boolean;
  hoverPreviewGallery: boolean;
  waypointListMapLinks: boolean;
  snowResearch: boolean;
}

export type TourDetailsAutoload = Record<TourListPageType, boolean>;

export type AppLocale = "de" | "en" | "it" | "fr";

export type ExternalMapProvider = "gmaps" | "osm" | "mapy" | "swisstopo" | "bergfex" | "openTopoMap" | "nakarte" | "ppete" | "custom";

export interface ExtensionSettings {
  language: AppLocale;
  features: FeatureSettings;
  provider: {
    routeProvider: RouteProviderId;
    mapProvider: MapProviderId;
    apiKeys: Partial<Record<RouteProviderId | MapProviderId, string>>;
    orsRateLimitPerMinute: number;
    fuelPricePerLitre: number;
    fuelConsumptionLPer100km: number;
  };
  cache: {
    routeTtlDays: number;
    locationClusterMeters: number;
  };
  search: {
    extraPagesToLoad: number;
    homePagesToLoad: number;
  };
  location: {
    fallbackStart?: Coordinates;
    preferBrowserLocation: boolean;
  };
  ui: {
    alwaysOpenMiniMaps: boolean;
    waypointGmapsLinks: boolean;
    wideLayout: boolean;
    externalMapProvider: ExternalMapProvider;
    externalMapZoom: number;
    externalMapCustomTemplate?: string;
    hoverPreviewDelay: number;
    galleryPreloadCount: number;
    snowHighestPeakOnly: boolean;
  };
  dev: {
    consoleLogging: boolean;
  };
  sort: {
    auto: boolean;
    key: string;
    dir: import("./sort").SortDir;
  };
  tourDetailsAutoload: TourDetailsAutoload;
  savedLocations: SavedLocation[];
  searchPresets: SearchPreset[];
  migration: {
    userscriptMigratedAt?: number;
    externalMapDefaultMigratedAt?: number;
  };
}

export interface SavedLocation {
  id: string;
  name: string;
  coordinates: string;
  createdAt: number;
}

export interface SearchPreset {
  id: string;
  name: string;
  fields: Record<string, string | boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface TourCacheRecord {
  id: string;
  url: string;
  title?: string;
  dateOfHike?: string;
  hikingGrade?: string;
  climbingGrade?: string;
  tourDuration?: string;
  heightGain?: string;
  heightLoss?: string;
  routeLength?: string;
  waypointUrls: string[];
  waypoints: TourWaypointEntry[];
  maxElevation?: number;
  galleryPhotoIds?: string[];
  geodataLinks: GeodataLink[];
  startWaypointUrl?: string;
  startWaypointName?: string;
  endWaypointName?: string;
  publishedBy?: string;
  publishedByUrl?: string;
  publishedAt?: string;
  photoCount?: number;
  geodataCount?: number;
  cacheVersion: number;
  parsedAt: number;
  missingFields: string[];
}

export interface TourWaypointEntry {
  url?: string;
  name: string;
  elevation?: number;
  visits?: number;
}

export const TOUR_CACHE_VERSION = 4;

export interface AnnotatedPeak {
  name: string;
  elevation: number;
  dirUrl?: string;
  x?: number;  // relative position on photo (0–1)
  y?: number;
}

export interface PhotoAnnotationCache {
  photoId: string;
  peaks: AnnotatedPeak[];
  fetchedAt: number;
  expiresAt: number;
}

export interface GeodataLink {
  url: string;
  format: "gpx" | "kml" | "kmz" | "unknown";
  label: string;
}

export interface WaypointCacheRecord {
  id: string;
  url: string;
  name?: string;
  coordinates?: Coordinates;
  elevation?: number;
  parsedAt: number;
  missingFields: string[];
}

export interface RouteRequest {
  provider: RouteProviderId;
  apiKey: string;
  mode: TravelMode;
  start: Coordinates;
  target: Coordinates;
  snapRadiiMeters?: {
    start?: number;
    target?: number;
  };
}

export interface RouteResult {
  provider: RouteProviderId;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  snapRadiiMeters?: {
    start: number;
    target: number;
  };
  raw?: unknown;
}

export interface RouteCacheRecord extends RouteResult {
  id: string;
  routeStatus?: "ok";
  mode: TravelMode;
  start: Coordinates;
  target: Coordinates;
  startCell: string;
  fetchedAt: number;
  expiresAt: number;
}

export interface RouteFailureCacheRecord {
  id: string;
  routeStatus: "unroutable";
  provider: RouteProviderId;
  mode: TravelMode;
  start: Coordinates;
  target: Coordinates;
  startCell: string;
  error: string;
  fetchedAt: number;
  expiresAt: number;
}

export type RouteCacheEntry = RouteCacheRecord | RouteFailureCacheRecord;

export interface GeocodeResult {
  id: string;
  provider: "photon";
  query: string;
  displayName: string;
  coordinates: Coordinates;
  fetchedAt: number;
  expiresAt: number;
}

export interface CacheStats {
  tours: number;
  waypoints: number;
  routes: number;
}

export interface ExcelExportRequest {
  tours: TourCacheRecord[];
  waypoints: WaypointCacheRecord[];
  routes?: RouteCacheRecord[];
  filename?: string;
}

export interface MapPoint {
  id: string;
  title: string;
  url?: string;
  coordinates: Coordinates;
}
