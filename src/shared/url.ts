import type { PageContext, PageType } from "./types";

const TOUR_RE = /https:\/\/www\.hikr\.org\/tour\/post\d+\.html/i;
const WAYPOINT_RE = /^https:\/\/www\.hikr\.org\/dir\/[^/"'?#\s]+\/?$/i;
const REGION_RE = /^\/region\d+\.html$/i;
// Any path ending in /tour/ is a tour listing — the global list (/tour/), a region's
// list (/region1179/tour/), a user's list (/leute/…/tour/), incl. ?skip= pagination.
// Single tours (/tour/postN.html) are matched earlier and never reach this.
const TOUR_LIST_RE = /\/tour\/?$/i;

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
  const slug = normalizeHikrUrl(url).split("/dir/")[1]?.replace(/\//g, "");
  if (!slug) return normalizeHikrUrl(url);
  // hikr's numeric place id (piz_id) is the stable identity and always ends the
  // slug (e.g. /dir/Berggasthof_Oytalhaus_11039 → 11039). Key the waypoint cache
  // by it so harvested `pizs` and fetched pages share the same record.
  return slug.match(/(\d+)$/)?.[1] ?? slug;
}

export function isTourUrl(url: string): boolean {
  return TOUR_RE.test(url);
}

export function isWaypointUrl(url: string): boolean {
  return WAYPOINT_RE.test(url);
}

export function collectHikrTourUrls(root: ParentNode, baseUrl = location.href): string[] {
  const urls = new Set<string>();
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? anchor.href;
    try {
      const url = absoluteUrl(href, baseUrl);
      const normalized = normalizeHikrUrl(url);
      if (isTourUrl(normalized)) urls.add(normalized);
    } catch {
      /* Ignore malformed/non-http hrefs from the page. */
    }
  });
  return [...urls];
}

function isFilteredOutListing(card: HTMLElement): boolean {
  return card.classList.contains("hikr-ext-listing-filter-hidden")
    || card.classList.contains("hikr-ext-listing-filter-fade");
}

// Tour URLs from listings still visible after the listing filter. Resolved per
// anchor against its NEAREST `.content-list` card (not by iterating cards), so a
// nested/outer wrapper that also carries the `.content-list` class can never leak
// the hidden tours it contains back in. Anchors outside any card are ignored —
// only tours that belong to a listing card count.
export function collectVisibleListingTourUrls(root: ParentNode, baseUrl = location.href): string[] {
  const urls = new Set<string>();
  root.querySelectorAll<HTMLAnchorElement>(".content-list a[href]").forEach((anchor) => {
    const card = anchor.closest<HTMLElement>(".content-list");
    if (card && isFilteredOutListing(card)) return;
    const href = anchor.getAttribute("href") ?? anchor.href;
    try {
      const normalized = normalizeHikrUrl(absoluteUrl(href, baseUrl));
      if (isTourUrl(normalized)) urls.add(normalized);
    } catch {
      /* Ignore malformed/non-http hrefs from the page. */
    }
  });
  return [...urls];
}

export function collectHikrWaypointUrls(root: ParentNode, baseUrl = location.href): string[] {
  const urls = new Set<string>();
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? anchor.href;
    try {
      const url = absoluteUrl(href, baseUrl);
      const normalized = normalizeHikrUrl(url);
      if (isWaypointUrl(normalized)) urls.add(normalized);
    } catch {
      /* Ignore malformed/non-http hrefs from the page. */
    }
  });
  return [...urls];
}

// Pages where automatic drive-time routing is allowed. Single source of truth
// shared by the behavioral gate (routes.ts) and the panel UI (panel.ts) so the
// toggle and the auto path can never disagree.
const AUTO_ROUTE_PAGE_TYPES = new Set<PageType>(["searchResults", "tour", "waypoint"]);

export function isAutoRoutePageType(pageType: PageType): boolean {
  return AUTO_ROUTE_PAGE_TYPES.has(pageType);
}

function detectPageType(url: URL, documentRef: Document): PageType {
  if (url.pathname.includes("/filter.php")) return url.search ? "searchResults" : "explore";
  if (/\/tour\/post\d+\.html/i.test(url.pathname)) return "tour";
  // A region's tour list (/region127/tour/, incl. ?skip= / ?post_sort_dir= pages)
  // is treated as a region listing so the "region" autoload setting governs it.
  if (/^\/region\d+\/tour\/?$/i.test(url.pathname)) return "region";
  // Favourite / curated lists (/list/6942/, incl. ?skip= pagination) are tour lists.
  if (/^\/list\/\d+\/?$/i.test(url.pathname)) return "tourList";
  if (TOUR_LIST_RE.test(url.pathname)) return "tourList";
  if (url.pathname.includes("/dir/")) return "waypoint";
  if (REGION_RE.test(url.pathname)) return "region";
  if (url.pathname === "/" || url.pathname === "/index.html") return "home";
  if (documentRef.querySelector("#new_gallery")) return "gallery";
  return "hikr";
}

export function detectPageContext(documentRef: Document, href = location.href): PageContext {
  const url = new URL(href);
  const pageType: PageType = detectPageType(url, documentRef);

  return {
    url: href,
    pageType,
    isTopFrame: window.top === window,
    tourUrls: collectHikrTourUrls(documentRef, href),
    waypointUrls: collectHikrWaypointUrls(documentRef, href),
    hasListings: Boolean(documentRef.querySelector(".content-list")),
    hasGallery: Boolean(documentRef.querySelector("#new_gallery")),
    hasExploreForm: Boolean(documentRef.querySelector('form[action*="filter.php"]'))
  };
}
