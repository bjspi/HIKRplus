import type {
  CacheStats,
  ExcelExportRequest,
  ExtensionSettings,
  GeocodeResult,
  PhotoAnnotationCache,
  RouteFailureCacheRecord,
  RouteCacheRecord,
  RouteRequest,
  SavedLocation,
  SearchPreset,
  TourCacheRecord,
  WaypointCacheRecord
} from "./types";

export type MessageRequest =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "SAVE_SAVED_LOCATIONS"; savedLocations: SavedLocation[] }
  | { type: "SAVE_SEARCH_PRESETS"; searchPresets: SearchPreset[] }
  | { type: "GET_CACHE_STATS" }
  | { type: "CLEAR_CACHE" }
  | { type: "CLEAR_ROUTES" }
  | { type: "FETCH_HIKR_PAGE"; url: string }
  | { type: "GEOCODE_LOCATION"; query: string }
  | { type: "GEOCODE_SUGGESTIONS"; query: string }
  | { type: "GET_CACHED_TOUR"; id: string }
  | { type: "PUT_CACHED_TOUR"; tour: TourCacheRecord }
  | { type: "GET_CACHED_WAYPOINT"; id: string }
  | { type: "PUT_CACHED_WAYPOINT"; waypoint: WaypointCacheRecord }
  | { type: "GET_ROUTE"; request: RouteRequest; tourId?: string }
  | { type: "EXPORT_EXCEL"; request: ExcelExportRequest }
  | { type: "MIGRATE_USERSCRIPT_SETTINGS"; values: Record<string, string | null> }
  | { type: "OPEN_OPTIONS_PAGE" }
  | { type: "OPEN_EXTERNAL_URL"; url: string }
  | { type: "FETCH_PHOTO_ANNOTATIONS"; photoId: string };

export type MessageResponse =
  | { settings: ExtensionSettings }
  | { stats: CacheStats }
  | { ok: true }
  | { ok: false; error: string }
  | { html: string }
  | { geocode: GeocodeResult | undefined }
  | { geocodes: GeocodeResult[] }
  | { tour: TourCacheRecord | undefined }
  | { waypoint: WaypointCacheRecord | undefined }
  | { route: RouteCacheRecord }
  | { routeFailure: RouteFailureCacheRecord }
  | { migrated: boolean; settings: ExtensionSettings }
  | { annotations: PhotoAnnotationCache };

export async function sendMessage<T extends MessageResponse>(message: MessageRequest): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
