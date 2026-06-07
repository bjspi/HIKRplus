import { describe, expect, it } from "vitest";
import { collectHikrTourUrls, collectHikrWaypointUrls, collectVisibleListingTourUrls, getTourId, getWaypointId, isAutoRoutePageType, normalizeHikrUrl } from "../shared/url";

describe("url helpers", () => {
  it("normalizes URLs and removes query/hash/trailing slash", () => {
    expect(normalizeHikrUrl("https://www.hikr.org/dir/Test_123/?x=1#top")).toBe("https://www.hikr.org/dir/Test_123");
  });

  it("extracts tour and waypoint ids", () => {
    expect(getTourId("https://www.hikr.org/tour/post12345.html")).toBe("12345");
    expect(getWaypointId("https://www.hikr.org/dir/Test_123/")).toBe("123");
  });

  it("allows automatic routes on search, tour, and waypoint pages", () => {
    expect(isAutoRoutePageType("searchResults")).toBe(true);
    expect(isAutoRoutePageType("tour")).toBe(true);
    expect(isAutoRoutePageType("waypoint")).toBe(true);
    expect(isAutoRoutePageType("home")).toBe(false);
  });

  it("collects normalized HIKR tour and waypoint URLs from the current DOM", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a href="/tour/post12345.html?x=1#top">Tour</a>
      <a href="https://www.hikr.org/tour/post12345.html">Duplicate</a>
      <a href="/dir/Test_123/?foo=bar">Waypoint</a>
      <a href="mailto:test@example.com">Mail</a>
    `;

    expect(collectHikrTourUrls(root, "https://www.hikr.org/filter.php")).toEqual(["https://www.hikr.org/tour/post12345.html"]);
    expect(collectHikrWaypointUrls(root, "https://www.hikr.org/filter.php")).toEqual(["https://www.hikr.org/dir/Test_123"]);
  });

  it("collects tour URLs only from listings that are still visible after filtering", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="content-list"><a href="/tour/post100.html">Visible</a></div>
      <div class="content-list hikr-ext-listing-filter-fade"><a href="/tour/post200.html">Fading</a></div>
      <div class="content-list hikr-ext-listing-filter-hidden"><a href="/tour/post300.html">Hidden</a></div>
      <a href="/tour/post400.html">Outside listing</a>
    `;

    expect(collectVisibleListingTourUrls(root, "https://www.hikr.org/filter.php")).toEqual(["https://www.hikr.org/tour/post100.html"]);
  });

  it("returns an empty list when all listings are filtered out", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="content-list hikr-ext-listing-filter-hidden"><a href="/tour/post100.html">Hidden</a></div>
      <div class="content-list hikr-ext-listing-filter-fade"><a href="/tour/post200.html">Fading</a></div>
    `;

    expect(collectVisibleListingTourUrls(root, "https://www.hikr.org/filter.php")).toEqual([]);
  });

  it("uses the nearest card so a nested .content-list wrapper cannot leak filtered tours", () => {
    // An outer wrapper carrying the same `.content-list` class (without a filter
    // class) must NOT reintroduce the hidden inner cards' tours onto the map.
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="content-list">
        <div class="content-list"><a href="/tour/post100.html">Visible</a></div>
        <div class="content-list hikr-ext-listing-filter-hidden"><a href="/tour/post200.html">Hidden</a></div>
      </div>
    `;

    expect(collectVisibleListingTourUrls(root, "https://www.hikr.org/filter.php")).toEqual(["https://www.hikr.org/tour/post100.html"]);
  });
});
