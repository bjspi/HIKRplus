import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LISTING_FILTER_STATE,
  applyListingFilter,
  collectListingMetadata,
  initializeListingFilter,
  openListingFilterMenu,
  resetListingFilterStateForTests,
  updateListingFilterVisibility
} from "../content/features/listing-filter";
import type { FeatureContext } from "../content/feature-types";
import type { ExtensionSettings, PageContext } from "../shared/types";
import { sortCards, writeTourSortData } from "../content/sort-data";
import { parseTourDocument } from "../shared/parser";
import { resolveFilterVisibility, resolveFilterSliderRanges, type FilterVisibility, type FilterSliderRangeInput } from "../shared/filter-settings";

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

function panelContext(pageType: PageContext["pageType"] = "home", filters?: Partial<FilterVisibility>, ranges?: FilterSliderRangeInput): FeatureContext {
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
    settings: { filters: resolveFilterVisibility(filters), filterSliderRanges: resolveFilterSliderRanges(ranges) } as ExtensionSettings,
    log: () => undefined
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  // Recent Node versions expose a non-DOM localStorage without a backing file.
  // Use a fresh browser-like store so persistence tests actually exercise writes.
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); }
  });
  resetListingFilterStateForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("listing filter DOM helpers", () => {
  it("spreads I–III across the entire slider without filtering until applied", () => {
    const easy = addListing("Easy", badge("II", "Climbing grading"));
    const hard = addListing("Hard", badge("VI", "Climbing grading"));
    openListingFilterMenu(panelContext("home", undefined, { climb: { min: 100, max: 300 } }));
    const min = document.querySelector<HTMLInputElement>('[data-hikr-filter="climb-min"]')!;
    const max = document.querySelector<HTMLInputElement>('[data-hikr-filter="climb-max"]')!;
    expect([min.min, min.max, min.value, max.value]).toEqual(["0", "2", "0", "2"]);
    expect(document.querySelector('[data-hikr-filter-output="climb"]')?.textContent).toBe("Alle");
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 2");
    min.value = "1";
    min.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector<HTMLElement>('[data-hikr-range="climb"]')!.style.getPropertyValue("--hikr-filter-start")).toBe("50%");
    expect(document.querySelector('[data-hikr-filter-output="climb"]')?.textContent).toBe("II - III");
    expect(easy.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(hard.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-hikr-filter-reset]')!.click();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 2");
    expect(max.max).toBe("2");
    document.querySelector<HTMLButtonElement>('[data-hikr-apply-range="climb"]')!.click();
    expect(document.querySelector('[data-hikr-filter-output="climb"]')?.textContent).toBe("I - III");
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 2");
  });

  it("preserves saved bounds outside the compact domain across live settings changes and reloads", () => {
    addListing("Tour", badge("T5", "Hiking grading") + badge("VI", "Climbing grading"));
    const context = panelContext();
    openListingFilterMenu(context);
    const max = document.querySelector<HTMLInputElement>('[data-hikr-filter="hike-max"]')!;
    max.value = "11"; // T6
    max.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLInputElement>('[data-hikr-filter="persist"]')!.click();
    updateListingFilterVisibility(context.settings.filters, { hike: { min: 300, max: 530 } });
    expect(document.querySelector<HTMLInputElement>('[data-hikr-filter="hike-max"]')!.max).toBe("11");
    expect(document.querySelector('[data-hikr-filter-output="hike"]')?.textContent).toBe("T1 - T6");
    expect(document.querySelector('[data-hikr-slider-note="hike"]')?.textContent).toContain("erweitert");
    document.querySelector('.hikr-ext-listing-filter-menu')!.remove();
    initializeListingFilter(context);
    expect(document.querySelector('[data-hikr-filter-output="hike"]')?.textContent).toBe("T1 - T6");
    document.querySelector<HTMLButtonElement>('[data-hikr-filter-reset]')!.click();
    const newMin = document.querySelector<HTMLInputElement>('[data-hikr-filter="hike-min"]')!;
    const newMax = document.querySelector<HTMLInputElement>('[data-hikr-filter="hike-max"]')!;
    expect([newMin.min, newMax.max]).toEqual(["2", "9"]); // T3 to T5+
    newMax.value = "5"; // T4: other visible handle is T3, not T1
    newMax.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector('[data-hikr-filter-output="hike"]')?.textContent).toBe("T3 - T4");
    expect(JSON.parse(localStorage.getItem("hikr.ext.listingFilter.state")!).hikeMin).toBe(2);
    document.querySelector('.hikr-ext-listing-filter-menu')!.remove();
    initializeListingFilter(context);
    expect(document.querySelector('[data-hikr-filter-output="hike"]')?.textContent).toBe("T3 - T4");
  });

  it("supports a single-grade domain without invalid positions", () => {
    addListing("II", badge("II", "Climbing grading"));
    addListing("III", badge("III", "Climbing grading"));
    openListingFilterMenu(panelContext("home", undefined, { climb: { min: 200, max: 200 } }));
    expect(document.querySelector<HTMLInputElement>('[data-hikr-filter="climb-max"]')!.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-hikr-apply-range="climb"]')!.click();
    expect(document.querySelector('[data-hikr-filter-output="climb"]')?.textContent).toBe("II - II");
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 2");
    expect(document.querySelector('[data-hikr-range="climb"]')?.getAttribute("style")).not.toMatch(/NaN|Infinity/);
  });

  it.each([
    ["de", "Wandern Schwierigkeit", "Klettern Schwierigkeit"],
    ["en", "Hiking grading", "Climbing grading"],
    ["it", "Difficolt&amp;agrave; escursionismo", "Difficolt&amp;agrave; arrampicata"],
    ["fr", "Difficulté randonnée", "Difficulté escalade"]
  ])("filters and sorts localized hiking/climbing listings end to end in %s", (_locale, hikeLabel, climbLabel) => {
    const hard = addListing("Hard", badge("T5+", hikeLabel) + badge("6a", climbLabel), "(Photos:2)");
    const easy = addListing("Easy", badge("T3", hikeLabel) + badge("II", climbLabel), "(Photos:3)");
    const unknown = addListing("Unknown", "", "(Photos:4)");
    openListingFilterMenu(panelContext("searchResults"));
    const hikeMax = document.querySelector<HTMLInputElement>('[data-hikr-filter="hike-max"]')!;
    hikeMax.value = "5"; // T4
    hikeMax.dispatchEvent(new Event("input", { bubbles: true }));
    const climbMax = document.querySelector<HTMLInputElement>('[data-hikr-filter="climb-max"]')!;
    climbMax.value = "1"; // II
    climbMax.dispatchEvent(new Event("input", { bubbles: true }));
    vi.runOnlyPendingTimers();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 3");
    expect(hard.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    expect(hard.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    expect(easy.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(unknown.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    document.querySelector<HTMLInputElement>('[data-hikr-filter="hide-missing-climb"]')!.click();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 3");
    document.querySelector<HTMLButtonElement>('[data-hikr-filter-reset]')!.click();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("3 / 3");
    for (const key of ["hikrGradeHike", "hikrGradeClimb"]) {
      sortCards(key, "asc");
      expect([...document.querySelectorAll(".content-list")]).toEqual([easy, hard, unknown]);
      sortCards(key, "desc");
      expect([...document.querySelectorAll(".content-list")]).toEqual([hard, easy, unknown]);
    }
    expect(hard.dataset.hikrGradeClimb).toBe("605");
    expect(easy.nextElementSibling?.textContent).toContain("Photos:3");
  });

  it("defaults to hiding only the optional controls, not via ferrata or snowshoe tours", () => {
    addListing("Via ferrata", badge("K4", "Klettersteig Schwierigkeit"));
    addListing("Snowshoe", badge("WT3", "Snowshoe grading"));
    openListingFilterMenu(panelContext());
    expect(document.querySelector('[data-hikr-filter="via-ferrata-max"]')).toBeNull();
    expect(document.querySelector('[data-hikr-filter="snowshoe-max"]')).toBeNull();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 2");
    updateListingFilterVisibility({ "via-ferrata": true, snowshoe: true });
    expect(document.querySelector('[data-hikr-filter="via-ferrata-max"]')).not.toBeNull();
    expect(document.querySelector('[data-hikr-filter="snowshoe-max"]')).not.toBeNull();
  });

  it("clears a disabled exclusion immediately, persists the reset and keeps rebuilt controls functional", () => {
    const tour = addListing("Ski", badge("AD", "Ski grading"), "(Fotos:3)");
    openListingFilterMenu(panelContext());
    document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!.click();
    document.querySelector<HTMLInputElement>('[data-hikr-filter="persist"]')!.click();
    vi.runOnlyPendingTimers();
    expect(tour.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    updateListingFilterVisibility({ ski: false });
    expect(document.querySelector('[data-hikr-filter="ski-max"]')).toBeNull();
    expect(tour.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(tour.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(JSON.parse(localStorage.getItem("hikr.ext.listingFilter.state")!).excludeSki).toBe(false);
    updateListingFilterVisibility({ ski: true });
    const exclude = document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!;
    expect(exclude.checked).toBe(false);
    exclude.click();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("0 / 1");
  });

  it("does not apply persisted ranges or missing-value constraints for disabled filters", () => {
    addListing("Unknown", "", "(Fotos:2)");
    addListing("Mixed", badge("T5", "Hiking grading") + badge("VI", "Climbing grading"), "(Fotos:2)", 'data-hikr-drive-duration="200"');
    localStorage.setItem("hikr.ext.listingFilter.state", JSON.stringify({
      version: 2, persist: true, hikeMax: 0, climbMax: 0, driveMax: 0,
      hideMissingHike: true, hideMissingClimb: true, hideMissingDrive: true, geodataOnly: true
    }));
    initializeListingFilter(panelContext("searchResults", { hike: false, climb: false, drive: false, geodata: false }));
    for (const key of ["hike-max", "climb-max", "drive-max", "geodata"]) {
      expect(document.querySelector(`[data-hikr-filter="${key}"]`)).toBeNull();
    }
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 2");
  });

  it("responds to synced option changes even with the menu closed", () => {
    const addListener = vi.fn();
    vi.stubGlobal("chrome", { storage: { onChanged: { addListener } } });
    const tour = addListing("Ski", badge("AD", "Ski grading"));
    const context = panelContext();
    initializeListingFilter(context);
    const listener = addListener.mock.calls[0][0];
    openListingFilterMenu(context);
    document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!.click();
    openListingFilterMenu(context);
    listener({ "hikr.settings": { newValue: { filters: { ski: false } } } }, "sync");
    expect(tour.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    openListingFilterMenu(context);
    expect(document.querySelector('[data-hikr-filter="exclude-ski"]')).toBeNull();
  });

  it("completely hides ski and ice tours with their footers, including mixed and appended results", () => {
    const ski = addListing("Skitour", badge("AD", "Ski grading"), "(Fotos:7)");
    const ice = addListing("Eistour", badge("WI3", "Difficolt&amp;agrave; cascate di ghiaccio"), "(Fotos:5)");
    const mixed = addListing("Mixed", badge("PD", "Difficulté ski") + badge("WI2", "Difficulté cascade de glace"), "(Fotos:9)");
    const hike = addListing("Hike", badge("T4", "Wandern Schwierigkeit"), "(Fotos:2)");
    const groups = collectListingMetadata().slice(0, 3).map((meta) => meta.group);
    openListingFilterMenu(panelContext("searchResults"));
    const skiCheckbox = document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!;
    const iceCheckbox = document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ice-climbing"]')!;
    skiCheckbox.click();
    iceCheckbox.click();
    vi.runOnlyPendingTimers();
    for (const group of groups) {
      expect(group).toHaveLength(2);
      for (const element of group) expect(element.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    }
    expect(hike.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 4");
    const appended = addListing("More ice", badge("WI4", "Eisklettern Schwierigkeit"), "(Fotos:1)");
    document.dispatchEvent(new CustomEvent("hikr:ext:tours-appended", { detail: { tourUrls: [] } }));
    vi.runOnlyPendingTimers();
    expect(appended.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    expect(appended.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    iceCheckbox.click();
    expect(ice.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(ice.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(ski.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    expect(mixed.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("3 / 5");
  });

  it.each([
    ["via-ferrata", "Difficulté via ferrata", "PD+", "D-", "viaFerrataGrade", 4, 3],
    ["ice-climbing", "Ice climbing grading", "WI3", "WI5", "iceClimbingGrade", 300, 2],
    ["snowshoe", "Snowshoe grading", "WT2", "WT5", "snowshoeGrade", 2, 1]
  ] as const)("filters and excludes %s independently of a ski grade", (key, label, easy, hard, field, rank, max) => {
    const matching = addListing("Easy", badge(easy, label));
    const difficult = addListing("Hard mixed tour", badge(hard, label) + badge("PD", "Ski grading"));
    const skiOnly = addListing("Ski", badge("PD", "Ski grading"));
    openListingFilterMenu(panelContext("home", { [key]: true }));
    const range = document.querySelector<HTMLInputElement>(`[data-hikr-filter="${key}-max"]`)!;
    range.value = String(max);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(collectListingMetadata()[0][field]).toBe(rank);
    expect(matching.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(difficult.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(skiOnly.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    const hideMissing = document.querySelector<HTMLInputElement>(`[data-hikr-filter="hide-missing-${key}"]`)!;
    hideMissing.checked = true;
    hideMissing.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 3");
    const exclude = document.querySelector<HTMLInputElement>(`[data-hikr-filter="exclude-${key}"]`)!;
    exclude.checked = true;
    exclude.dispatchEvent(new Event("change", { bubbles: true }));
    expect(range.disabled).toBe(true);
    expect(matching.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(skiOnly.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
  });

  it("retains a saved hiking range but ignores disabled snowshoe filters", () => {
    addListing("Tour", badge("T5", "Hiking grading"));
    addListing("Snowshoe tour", badge("T5", "Hiking grading") + badge("WT2", "Snowshoe grading"));
    localStorage.setItem("hikr.ext.listingFilter.state", JSON.stringify({
      version: 2, persist: true, hikeMin: 3, hikeMax: 7,
      snowshoeMin: 4, snowshoeMax: 5, hideMissingSnowshoe: true, excludeSnowshoe: true
    }));
    initializeListingFilter(panelContext());
    expect(document.querySelector('[data-hikr-filter-output="hike"]')?.textContent).toBe("T4- - T5");
    expect(document.querySelector('[data-hikr-filter-output="via-ferrata"]')).toBeNull();
    expect(document.querySelector('[data-hikr-filter-output="ice-climbing"]')?.textContent).toBe("WI1 - WI7");
    expect(document.querySelector('[data-hikr-filter-output="snowshoe"]')).toBeNull();
    expect(document.querySelector('input[data-hikr-filter*="snowshoe"]')).toBeNull();
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("2 / 2");
  });

  it("independently filters alpine and ski grades on a mixed tour", () => {
    const mixed = addListing("Mixed", badge("PD+", "Mountaineering grading") + badge("AD", "Ski grading"));
    const ski = addListing("Ski", badge("PD", "Ski grading"));
    const hike = addListing("Hike", badge("T3", "Hiking grading"));
    const stats = applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, skiMax: 3 }); // WS+
    expect(stats.visible).toBe(2);
    expect(mixed.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(ski.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(hike.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, mountaineeringMax: 3, hideMissingMountaineering: true });
    expect(mixed.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(ski.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(hike.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
  });

  it("excludes a discipline including mixed tours without confusing identical grades", () => {
    const mixed = addListing("Mixed", badge("WS", "Hochtouren Schwierigkeit") + badge("S", "Ski Schwierigkeit"));
    const alpine = addListing("Alpine", badge("WS", "Hochtouren Schwierigkeit"));
    const bike = addListing("Bike", badge("S", "Mountainbike Schwierigkeit"));
    expect(applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, excludeSki: true }).visible).toBe(2);
    expect(mixed.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(alpine.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(bike.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    expect(applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, excludeMountaineering: true }).visible).toBe(1);
    expect(applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, mountainbikeMax: 1, hideMissingMountainbike: true }).visible).toBe(0);
  });

  it("updates an active exclusion when tour details arrive after badge metadata was cached", () => {
    const c = addListing("Tour", "");
    openListingFilterMenu(panelContext());
    const exclude = document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!;
    exclude.checked = true;
    exclude.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 1");
    expect(document.querySelector<HTMLInputElement>('[data-hikr-filter="ski-max"]')!.disabled).toBe(true);
    const tour = parseTourDocument(new DOMParser().parseFromString(`<table><tr><td>Ski grading:</td><td>AD</td></tr></table>`, "text/html"), "https://www.hikr.org/tour/post1.html");
    writeTourSortData(c, tour);
    expect(collectListingMetadata()[0].skiGrade).toBe(6);
    expect(c.classList.contains("hikr-ext-listing-filter-fade")).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("0 / 1");
  });

  it("persists new discipline filters and resets them through the menu", () => {
    addListing("Tour", badge("D", "Difficolt&amp;agrave; sci"));
    const context = panelContext();
    openListingFilterMenu(context);
    for (const key of ["exclude-ski", "persist"]) {
      const input = document.querySelector<HTMLInputElement>(`[data-hikr-filter="${key}"]`)!;
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.querySelector(".hikr-ext-listing-filter-menu")!.remove();
    initializeListingFilter(context);
    expect(document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!.checked).toBe(true);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("0 / 1");
    document.querySelector<HTMLButtonElement>("[data-hikr-filter-reset]")!.click();
    expect(document.querySelector<HTMLInputElement>('[data-hikr-filter="exclude-ski"]')!.checked).toBe(false);
    expect(document.querySelector('[data-hikr-filter-result]')?.textContent).toBe("1 / 1");
  });

  it("migrates saved climbing bounds without changing their grades", () => {
    addListing("Tour", badge("VI", "Climbing grading"));
    localStorage.setItem("hikr.ext.listingFilter.state", JSON.stringify({ persist: true, climbMin: 3, climbMax: 5 }));
    initializeListingFilter(panelContext());
    expect(document.querySelector('[data-hikr-filter-output="climb"]')?.textContent).toBe("IV - VI");
    expect(document.querySelector('[data-hikr-filter-output="ski"]')?.textContent).toBe("L - EX");
  });

  it("reads visible difficulty badges and ignores existing data attributes", () => {
    addListing(
      "Tour",
      `${badge("T5", "Wandern Schwierigkeit")} ${badge("II", "Klettern Schwierigkeit")}`,
      "(Fotos:7 | Geodaten:1)",
      'data-hikr-grade-hike="1" data-hikr-grade-climb="8"'
    );

    const [meta] = collectListingMetadata();
    expect(meta.hikeGrade).toBe(500);
    expect(meta.climbGrade).toBe(200);
    expect(meta.geodataCount).toBe(1);
  });

  it.each(["Geodaten", "Geodata", "Géodonnées"])("filters %s footers without confusing photo or comment counts", (label) => {
    const withGeo = addListing("With track", badge("T3", "Hiking grading"), `(Photos:2 | ${label}:1)`);
    const withoutGeo = addListing("No track", badge("T3", "Hiking grading"), "(Photos:12 | Comments:3)");
    const zeroGeo = addListing("Zero", badge("T3", "Hiking grading"), `(Photos:2 | ${label}:0)`);
    const missingFooter = addListing("Unknown", badge("T3", "Hiking grading"));
    const stats = applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, geodataOnly: true });
    vi.runOnlyPendingTimers();
    expect(stats.visible).toBe(2);
    expect(withGeo.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    expect(withGeo.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(false);
    for (const hidden of [withoutGeo, zeroGeo]) {
      expect(hidden.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
      expect(hidden.nextElementSibling?.classList.contains("hikr-ext-listing-filter-hidden")).toBe(true);
    }
    expect(missingFooter.classList.contains("hikr-ext-listing-filter-muted")).toBe(true);
    expect(applyListingFilter(DEFAULT_LISTING_FILTER_STATE).visible).toBe(4);
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

  it("ignores .content-list cards inside the right sidebar (.menu_right / #menu_rs_swiss)", () => {
    const mainCard = addListing("Main", badge("T2", "Wandern Schwierigkeit"), "(Fotos:7 | Geodaten:1)");

    // The "In der Nähe" sidebar reuses the .content-list class inside
    // #menu_rs_swiss / .menu_right — the filter must never touch it.
    const sidebar = document.createElement("div");
    sidebar.id = "menu_rs_swiss";
    sidebar.innerHTML = `<div class="menu_right"><div class="content-list"><strong>Nearby</strong></div></div>`;
    document.body.append(sidebar);
    const sidebarCard = sidebar.querySelector<HTMLElement>(".content-list")!;

    // Collection (and therefore the visible/total count) sees only the main card.
    expect(collectListingMetadata()).toHaveLength(1);

    const stats = applyListingFilter({ ...DEFAULT_LISTING_FILTER_STATE, hideMissingHike: true });
    expect(stats.total).toBe(1);
    expect(mainCard.classList.contains("hikr-ext-listing-filter-fade")).toBe(false);
    // The sidebar card carries no filter classes at all.
    expect(sidebarCard.className).toBe("content-list");
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
