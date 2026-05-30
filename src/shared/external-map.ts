import type { Coordinates, ExternalMapProvider, ExtensionSettings } from "./types";

export interface ExternalMapInfo {
  href: string;
  label: string;
}

const LABELS: Record<ExternalMapProvider, string> = {
  gmaps: "Google Maps",
  osm: "OpenStreetMap",
  mapy: "Mapy.cz",
  swisstopo: "swisstopo",
  bergfex: "BergFex",
  openTopoMap: "OpenTopoMap",
  custom: "Karte"
};

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 15;
  return Math.max(3, Math.min(19, Math.round(zoom)));
}

function applyTemplate(template: string, lat: number, lng: number, zoom: number): string {
  return template
    .replace(/\{lat\}/g, String(lat))
    .replace(/\{lng\}/g, String(lng))
    .replace(/\{lon\}/g, String(lng))
    .replace(/\{zoom\}/g, String(zoom))
    .replace(/\{z\}/g, String(zoom));
}

function buildHref(provider: ExternalMapProvider, lat: number, lng: number, zoom: number, customTemplate?: string): string {
  switch (provider) {
    case "osm":
      return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
    case "mapy":
      return `https://mapy.cz/turisticka?x=${lng}&y=${lat}&z=${zoom}&source=coor&id=${lng},${lat}`;
    case "swisstopo":
      return `https://map.geo.admin.ch/?zoom=${zoom}&lang=de&topic=ech&lat=${lat}&lon=${lng}&crosshair=marker`;
    case "bergfex":
      return `https://www.bergfex.com/sommer/poi.php?lat=${lat}&lon=${lng}&zoom=${zoom}`;
    case "openTopoMap":
      return `https://opentopomap.org/#marker=${zoom}/${lat}/${lng}`;
    case "custom":
      if (customTemplate && customTemplate.trim()) return applyTemplate(customTemplate.trim(), lat, lng, zoom);
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    case "gmaps":
    default:
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&zoom=${zoom}`;
  }
}

export function externalMapUrl(coords: Coordinates, settings: ExtensionSettings): ExternalMapInfo {
  const provider = settings.ui.externalMapProvider ?? "gmaps";
  const zoom = clampZoom(settings.ui.externalMapZoom ?? 15);
  const href = buildHref(provider, coords.lat, coords.lng, zoom, settings.ui.externalMapCustomTemplate);
  return { href, label: LABELS[provider] ?? "Karte" };
}

export function externalMapLabel(provider: ExternalMapProvider): string {
  return LABELS[provider] ?? "Karte";
}
