import { clusterCoordinates } from "./coordinates";
import type { ExtensionSettings, RouteCacheEntry, RouteCacheRecord, RouteFailureCacheRecord, RouteRequest, RouteResult } from "./types";

export const ROUTE_START_CLUSTER_METERS = 2000;

export function routeStartCell(request: Pick<RouteRequest, "start">): string {
  return clusterCoordinates(request.start, ROUTE_START_CLUSTER_METERS);
}

export function routeCacheId(request: RouteRequest, settings: ExtensionSettings, _tourId?: string): string {
  void settings;
  const startCell = routeStartCell(request);
  const target = `${request.target.lat.toFixed(5)},${request.target.lng.toFixed(5)}`;
  return ["route", request.provider, request.mode, startCell, target].join(":");
}

export function toRouteCacheRecord(
  id: string,
  request: RouteRequest,
  settings: ExtensionSettings,
  result: RouteResult
): RouteCacheRecord {
  const fetchedAt = Date.now();
  return {
    ...result,
    id,
    routeStatus: "ok",
    mode: request.mode,
    start: request.start,
    target: request.target,
    startCell: routeStartCell(request),
    fetchedAt,
    expiresAt: fetchedAt + settings.cache.routeTtlDays * 24 * 60 * 60 * 1000
  };
}

export function toRouteFailureCacheRecord(
  id: string,
  request: RouteRequest,
  settings: ExtensionSettings,
  error: string
): RouteFailureCacheRecord {
  const fetchedAt = Date.now();
  return {
    id,
    routeStatus: "unroutable",
    provider: request.provider,
    mode: request.mode,
    start: request.start,
    target: request.target,
    startCell: routeStartCell(request),
    error,
    fetchedAt,
    expiresAt: fetchedAt + settings.cache.routeTtlDays * 24 * 60 * 60 * 1000
  };
}

export function routeCacheIsFresh(route: RouteCacheEntry): boolean {
  return route.expiresAt > Date.now();
}
