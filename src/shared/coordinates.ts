import type { Coordinates } from "./types";

const DD_PAIR_RE = /(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/;
const DMS_RE =
  /(\d{1,2})\D+(\d{1,2})\D+(\d{1,2}(?:\.\d+)?)\D*([NS])\D+(\d{1,3})\D+(\d{1,2})\D+(\d{1,2}(?:\.\d+)?)\D*([EW])/i;

export function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

export function convertDmsToDd(degrees: number, minutes: number, seconds: number, direction: string): number {
  const sign = /[SW]/i.test(direction) ? -1 : 1;
  return roundTo(sign * (degrees + minutes / 60 + seconds / 3600), 6);
}

export function parseCoordinates(text: string): Coordinates | undefined {
  const dms = text.match(DMS_RE);
  if (dms) {
    return {
      lat: convertDmsToDd(Number(dms[1]), Number(dms[2]), Number(dms[3]), dms[4]),
      lng: convertDmsToDd(Number(dms[5]), Number(dms[6]), Number(dms[7]), dms[8])
    };
  }

  const dd = text.match(DD_PAIR_RE);
  if (!dd) return undefined;
  const lat = Number(dd[1]);
  const lng = Number(dd[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat: roundTo(lat, 6), lng: roundTo(lng, 6) };
}

export function clusterCoordinates(coordinates: Coordinates, meters: number): string {
  const latMeters = 111_320;
  const lngMeters = 111_320 * Math.cos((coordinates.lat * Math.PI) / 180);
  const latCell = Math.round((coordinates.lat * latMeters) / meters);
  const lngCell = Math.round((coordinates.lng * lngMeters) / meters);
  return `${meters}m:${latCell}:${lngCell}`;
}

export function parseCoordinateInput(value: string): Coordinates | undefined {
  return parseCoordinates(value.trim());
}
