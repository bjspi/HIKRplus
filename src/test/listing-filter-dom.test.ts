import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LISTING_FILTER_STATE,
  applyListingFilter,
  collectListingMetadata,
  initializeListingFilter,
  openListingFilterMenu,
  resetListingFilterStateForTests
} from "../content/features/listing-filter";
import type { FeatureContext } from "../content/feature-types";
import type { ExtensionSettings, PageContext } from "../shared/types";

function badge(text: string, title: string): string {
  return `<span style="width:30px;background-color:#339933;color:#FFF;padding:0px 3px 0px 3px;" title="${title}"> ${text}</span>`;
}

function card(label: string, badges: string, attrs = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = "content-list";
  el.setAttribute("style", "min-height:83px;");
  if (attrs) {
    for (const part of attrs.trim().split(/\s+/)) {
      const [name, raw] = part.split("=");
      el.setAttribute(name, raw.replace(/^"|"$/g, ""));
    }
  }
  el.innerHTML = `<strong>${label}</strong><div>${badges}</div>`;
  return el;
}

function footer(text: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("style", "clear:both;padding-bottom:10px;");
  el.innerHTML = `<em class="author">Publiziert von </em><em class="author">${text}</em>`;
  return el;
}

function addListing(label: string, badges: string, footerText?: string, attrs = ""): HTMLElement {
  const c = card(label, badges, attrs);
  document.body.append(c);
  if (footerText !== undefined) document.body.append(footer(footerText));
  return c;
}

function panelContext(pageType: PageContext["pageType"] = "home"): FeatureContext {
  const root = document.createElement("div");
  root.id = "hikr-ext-root";
  root.innerHTML = `<section class="hikr-ext-panel"><main><div class="hikr-ext-button-row"><button data-hikr-action="filter">Filter</button></div></main></section>`;
  document.body.append(root);
  const page: PageContext = {
    url: "https://www.hikr.org/",
    pageType,
    isTopFrame: true,
    tourUrls: [],
    waypointUrls: [],
    hasListings: true,
    hasGallery: false,
    hasExploreForm: false
  };
  return {
    page,
    root,
    settings: {} as ExtensionSettings,
    log: () => undefined
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  resetListingFilterStateForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("listing filter DOM helpers", () => {
  it("reads visible difficulty badges and ignores existing data attributes", () => {
    addListing(
      "Tour",
      `${badge("T5", "Wandern Schwierigkeit")} ${badge("II", "Klettern Schwierigkeit")}`,
      "(Fotos:7 | Geodaten:1)",
      'data-hikr-grade-hike="1" data-hikr-grade-climb="8"'
    );

    const [meta] = collectListingMetadata();
    expect(meta.hikeGrade).toBe(5);
    expect(meta.climbGrade).toBe(2);
    expect(meta.geodataCount).toBe(1);
  });

  it("treats a footer without Geodaten text as 0 and a missing footer as unknown", () => {
    const withGeo = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const noGeoText = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:16)");
    const missingFooter = addListing("C", badge("T2", "Wandern Schwierigkeit"));

    applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, geodataOnly: true });

    expect(withGeo.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(noGeoText.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(missingFooter.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    vi.runOnlyPendingTimers();
    expect(noGeoText.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
  });

  it("fades definitive mismatches and keeps unknown grades visible but muted", () => {
    const matching = addListing("A", badge("T5", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const mismatch = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const unknown = addListing("C", "", "(Fotos:7 | Geodaten:1)");

    applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, hikeMin: 7, hikeMax: 11 });

    expect(matching.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(mismatch.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(unknown.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    expect(unknown.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
  });

  it("can hide listings without hiking difficulty explicitly", () => {
    const withHike = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const withoutHike = addListing("B", badge("II", "Klettern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");

    applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, hideMissingHike: true });

    expect(withHike.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(withoutHike.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
  });

  it("does not attach scripts or ad blocks between listings to the tour group", () => {
    const hidden = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const script = document.createElement("script");
    const ad = document.createElement("div");
    ad.className = "momo";
    document.body.append(script, ad);
    addListing("B", badge("T5", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");

    applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, hikeMin: 7, hikeMax: 11 });

    expect(hidden.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(script.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(ad.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
  });

  it("re-applies the active filter when pagination appends more listings", () => {
    addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const context = panelContext();
    openListingFilterMenu(context);
    const checkbox = document.querySelector<HTMLInputElement>('input[data-hikr-filter="geodata"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));

    const appended = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:8)");
    document.dispatchEvent(new CustomEvent("hikr:ext:tours-appended", { detail: { tourUrls: [] } }));

    expect(appended.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 2");
  });

  it("keeps the filter menu open on page clicks and toggles it only through the filter action", () => {
    addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const context = panelContext();
    openListingFilterMenu(context);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".hikr-ext-listing-filter-menu")).toBeTruthy();

    openListingFilterMenu(context);
    expect(document.querySelector(".hikr-ext-listing-filter-menu")).toBeNull();
  });

  it("exposes UI checkboxes for hiding missing hiking and climbing grades", () => {
    addListing("A", `${badge("T2", "Wandern Schwierigkeit")} ${badge("II", "Klettern Schwierigkeit")}`, "(Fotos:7 | Geodaten:1)");
    const withoutClimb = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const context = panelContext();
    openListingFilterMenu(context);

    expect(document.querySelector('input[data-hikr-filter="hide-missing-hike"]')).toBeTruthy();
    const hideMissingClimb = document.querySelector<HTMLInputElement>('input[data-hikr-filter="hide-missing-climb"]')!;
    hideMissingClimb.checked = true;
    hideMissingClimb.dispatchEvent(new Event("input", { bubbles: true }));

    expect(withoutClimb.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 2");
  });

  it("shows and applies the drive-time filter on search results only", () => {
    const shortDrive = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)", 'data-hikr-drive-duration="60"');
    const longDrive = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)", 'data-hikr-drive-duration="139.5"');
    const missingDrive = addListing("C", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const context = panelContext("searchResults");
    openListingFilterMenu(context);

    const driveMax = document.querySelector<HTMLInputElement>('input[data-hikr-filter="drive-max"]')!;
    driveMax.value = "18"; // 2 h
    driveMax.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelector('input[data-hikr-filter="hide-missing-drive"]')).toBeTruthy();
    expect(shortDrive.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(longDrive.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(missingDrive.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(missingDrive.classList.contains("hikr-ext-listing-filter-muted")).toBe(false);
    expect(document.querySelector('[data-hikr-filter-output="drive"]')?.textContent).toBe("0 min - 2 h");
  });

  it("can hide search listings without calculated drive time explicitly", () => {
    const withDrive = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)", 'data-hikr-drive-duration="60"');
    const withoutDrive = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    openListingFilterMenu(panelContext("searchResults"));

    const hideMissingDrive = document.querySelector<HTMLInputElement>('input[data-hikr-filter="hide-missing-drive"]')!;
    expect(hideMissingDrive.checked).toBe(false);
    hideMissingDrive.checked = true;
    hideMissingDrive.dispatchEvent(new Event("input", { bubbles: true }));

    expect(withDrive.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(withoutDrive.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 2");
  });

  it("shows the drive-time section on waypoint listing pages before calculation", () => {
    addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    openListingFilterMenu(panelContext("waypoint"));

    const driveMax = document.querySelector<HTMLInputElement>('input[data-hikr-filter="drive-max"]')!;
    expect(driveMax).toBeTruthy();
    expect(driveMax.disabled).toBe(true);
    expect(document.querySelector('[data-hikr-filter-output="drive"]')?.textContent).toBe("nach Berechnung");
  });

  it("enables the drive-time section on waypoint listing pages after calculation", () => {
    addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)", 'data-hikr-drive-duration="60"');
    openListingFilterMenu(panelContext("waypoint"));

    const driveMax = document.querySelector<HTMLInputElement>('input[data-hikr-filter="drive-max"]')!;
    expect(driveMax).toBeTruthy();
    expect(driveMax.disabled).toBe(false);
    expect(document.querySelector('[data-hikr-filter-output="drive"]')?.textContent).toBe("0 min - 5 h");
  });

  it("persists filters and auto-opens the menu on the next page load", () => {
    addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    openListingFilterMenu(panelContext());
    const geodata = document.querySelector<HTMLInputElement>('input[data-hikr-filter="geodata"]')!;
    geodata.checked = true;
    geodata.dispatchEvent(new Event("input", { bubbles: true }));
    const persist = document.querySelector<HTMLInputElement>('input[data-hikr-filter="persist"]')!;
    persist.checked = true;
    persist.dispatchEvent(new Event("input", { bubbles: true }));

    document.body.innerHTML = "";
    const withGeo = addListing("A", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");
    const noGeo = addListing("B", badge("T2", "Wandern Schwierigkeit"), "(Fotos:9)");
    initializeListingFilter(panelContext());

    expect(document.querySelector(".hikr-ext-listing-filter-menu")).toBeTruthy();
    expect(withGeo.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(noGeo.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
  });
});
