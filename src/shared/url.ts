import type { PageContext, PageType } from "./types";

const TOUR_RE = /https:\/\/www\.hikr\.org\/tour\/post\d+\.html/i;
const WAYPOINT_RE = /^https:\/\/www\.hikr\.org\/dir\/[^/"'?#\s]+\/?$/i;
const REGION_RE = /^\/region\d+\.html$/i;
const TOUR_LIST_RE = /^\/tour\/?$/i;

export function absoluteUrl(value: string, base = location.href): string {
  return new URL(value, base).href;
}

export function normalizeHikrUrl(value: string): string {
  const url = new URL(value, "https://www.hikr.org/");
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}

export function getTourId(url: string): string {
  return normalizeHikrUrl(url).match(/post(\d+)\.html/i)?.[1] ?? normalizeHikrUrl(url);
}

export function getWaypointId(url: string): string {
  return normalizeHikrUrl(url).split("/dir/")[1]?.replace(/\//g, "") ?? normalizeHikrUrl(url);
}

export function isTourUrl(url: string): boolean {
  return TOUR_RE.test(url);
}

export function isWaypointUrl(url: string): boolean {
  return WAYPOINT_RE.test(url);
}

function detectPageType(url: URL, documentRef: Document): PageType {
  if (url.pathname.includes("/filter.php")) return url.search ? "searchResults" : "explore";
  if (/\/tour\/post\d+\.html/i.test(url.pathname)) return "tour";
  if (TOUR_LIST_RE.test(url.pathname)) return "tourList";
  if (url.pathname.includes("/dir/")) return "waypoint";
  if (REGION_RE.test(url.pathname)) return "region";
  if (url.pathname === "/" || url.pathname === "/index.html") return "home";
  if (documentRef.querySelector("#new_gallery")) return "gallery";
  return "hikr";
}

export function detectPageContext(documentRef: Document, href = location.href): PageContext {
  const tourUrls = new Set<string>();
  const waypointUrls = new Set<string>();

  documentRef.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const url = absoluteUrl(anchor.href, href);
    if (isTourUrl(url)) tourUrls.add(normalizeHikrUrl(url));
    if (isWaypointUrl(url)) waypointUrls.add(normalizeHikrUrl(url));
  });

  const url = new URL(href);
  const pageType: PageType = detectPageType(url, documentRef);

  return {
    url: href,
    pageType,
    isTopFrame: window.top === window,
    tourUrls: [...tourUrls],
    waypointUrls: [...waypointUrls],
    hasGallery: Boolean(documentRef.querySelector("#new_gallery")),
    hasExploreForm: Boolean(documentRef.querySelector('form[action*="filter.php"]'))
  };
}
