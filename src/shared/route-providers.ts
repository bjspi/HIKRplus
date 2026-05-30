import type { RouteProviderId, RouteRequest, RouteResult } from "./types";
import { devLog, devWarn } from "./dev-log";

export interface RouteProvider {
  id: RouteProviderId;
  title: string;
  requiresApiKey: boolean;
  defaultTtlDays: number;
  getRoute(input: RouteRequest): Promise<RouteResult>;
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function safeErrorPayload(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

async function readJsonResponse(response: Response): Promise<{ data: unknown; text: string }> {
  const text = await response.text();
  if (!text) return { data: undefined, text };
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: undefined, text };
  }
}

interface OrsAttemptResult {
  response: Response;
  data: unknown;
  text: string;
  payload: {
    coordinates: number[][];
    radiuses: number[];
    instructions: boolean;
  };
}

const ORS_SNAP_RADII = [5000, 10000, 15000, 30000, 50000];

function orsErrorMessage(status: number, data: unknown): string {
  const body = data as { error?: { message?: string }; message?: string } | undefined;
  return body?.error?.message ?? body?.message ?? `OpenRouteService failed: ${status}`;
}

export function isUnroutableRouteErrorMessage(message: string): boolean {
  return /Could not find routable point/i.test(message);
}

function shouldRetryWithLargerRadius(response: Response, message: string): boolean {
  return response.status === 404 && isUnroutableRouteErrorMessage(message);
}

function snapRadiusSequence(hint?: number): number[] {
  const start = Math.max(5000, Number(hint) || 5000);
  const sequence = ORS_SNAP_RADII.filter((radius) => radius >= start);
  return sequence.length > 0 ? sequence : [ORS_SNAP_RADII[ORS_SNAP_RADII.length - 1]!];
}

export const openRouteServiceProvider: RouteProvider = {
  id: "ors",
  title: "OpenRouteService",
  requiresApiKey: true,
  defaultTtlDays: 7,
  async getRoute(input) {
    const url = new URL("https://api.openrouteservice.org/v2/directions/driving-car/json");
    const startRadii = snapRadiusSequence(input.snapRadiiMeters?.start);
    const targetRadii = snapRadiusSequence(input.snapRadiiMeters?.target);
    const attemptCount = Math.max(startRadii.length, targetRadii.length);
    let lastAttempt: OrsAttemptResult | undefined;
    for (let index = 0; index < attemptCount; index++) {
      const startRadius = startRadii[Math.min(index, startRadii.length - 1)]!;
      const targetRadius = targetRadii[Math.min(index, targetRadii.length - 1)]!;
      const payload = {
        coordinates: [
          [input.start.lng, input.start.lat],
          [input.target.lng, input.target.lat]
        ],
        radiuses: [startRadius, targetRadius],
        instructions: false
      };
      devLog("route", "ORS request", {
        url: url.href,
        attempt: index + 1,
        attempts: attemptCount,
        snapRadiusHint: input.snapRadiiMeters,
        start: input.start,
        target: input.target,
        radiuses: payload.radiuses
      });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: input.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const { data, text } = await readJsonResponse(response);
      lastAttempt = { response, data, text, payload };
      if (response.ok) break;
      const message = orsErrorMessage(response.status, data);
      devWarn("route", "ORS error", {
        status: response.status,
        statusText: response.statusText,
        message,
        retrying: index < attemptCount - 1 && shouldRetryWithLargerRadius(response, message),
        attempt: index + 1,
        attempts: attemptCount,
        start: input.start,
        target: input.target,
        payload,
        response: safeErrorPayload(data),
        responseText: text.slice(0, 1000)
      });
      if (!shouldRetryWithLargerRadius(response, message)) break;
    }
    if (!lastAttempt) throw new Error("OpenRouteService request was not executed");
    const { response, data, text, payload } = lastAttempt;
    if (!response.ok) {
      throw new Error(`OpenRouteService failed: ${response.status} ${orsErrorMessage(response.status, data)}`);
    }
    const body = data as { routes?: { summary?: { distance?: unknown; duration?: unknown } }[] } | undefined;
    const summary = body?.routes?.[0]?.summary;
    if (!summary) {
      devWarn("route", "ORS response missing summary", {
        status: response.status,
        start: input.start,
        target: input.target,
        response: safeErrorPayload(data),
        responseText: text.slice(0, 1000)
      });
      throw new Error("OpenRouteService response has no route summary");
    }
    const distanceMeters = Number(summary.distance);
    const durationSeconds = Number(summary.duration);
    devLog("route", "ORS ok", {
      start: input.start,
      target: input.target,
      radiuses: payload.radiuses,
      distanceMeters,
      durationSeconds
    });
    return {
      provider: "ors",
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds),
      snapRadiiMeters: {
        start: payload.radiuses[0]!,
        target: payload.radiuses[1]!
      },
      raw: data
    };
  }
};

export const googleRoutesProvider: RouteProvider = {
  id: "google",
  title: "Google Routes",
  requiresApiKey: true,
  defaultTtlDays: 7,
  async getRoute(input) {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: input.start.lat, longitude: input.start.lng } } },
        destination: { location: { latLng: { latitude: input.target.lat, longitude: input.target.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE"
      })
    });
    if (!response.ok) throw new Error(`Google Routes failed: ${response.status}`);
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("Google Routes response has no route");
    const distanceMeters = Number(route.distanceMeters);
    const durationSeconds = Number(String(route.duration ?? "0s").replace("s", ""));
    return {
      provider: "google",
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds),
      raw: data
    };
  }
};

export const routeProviders: Record<RouteProviderId, RouteProvider> = {
  ors: openRouteServiceProvider,
  google: googleRoutesProvider
};
