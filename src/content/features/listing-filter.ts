import { SAC_FILTER_STEPS, MOUNTAINBIKE_FILTER_STEPS, CLIMB_FILTER_STEPS, HIKE_FILTER_STEPS,
  VIA_FERRATA_FILTER_STEPS, ICE_CLIMBING_FILTER_STEPS, SNOWSHOE_FILTER_STEPS } from "../../shared/difficulty";
import { resolveFilterVisibility, resolveFilterSliderRanges, SLIDER_SCALES, type SliderKey, type FilterSliderRangeInput, type FilterVisibility } from "../../shared/filter-settings";
import { SETTINGS_KEY } from "../../shared/settings";
import { collectHikrTourUrls } from "../../shared/url";
import type { FeatureContext } from "../feature-types";
import { EVT_TOURS_APPENDED, onPipelineChange } from "../pipeline-status";
import { EVT_TOUR_GRADES_CHANGED, readCardGradeRanks } from "../sort-data";
import { ensureEnrichmentPipeline } from "./tour-details";

export { CLIMB_FILTER_STEPS, HIKE_FILTER_STEPS } from "../../shared/difficulty";

interface GradeStep {
  label: string;
  value: number;
}

export interface ListingFilterState {
  hikeMin: number;
  hikeMax: number;
  hideMissingHike: boolean;
  climbMin: number;
  climbMax: number;
  hideMissingClimb: boolean;
  mountaineeringMin: number;
  mountaineeringMax: number;
  hideMissingMountaineering: boolean;
  excludeMountaineering: boolean;
  skiMin: number;
  skiMax: number;
  hideMissingSki: boolean;
  excludeSki: boolean;
  mountainbikeMin: number;
  mountainbikeMax: number;
  hideMissingMountainbike: boolean;
  excludeMountainbike: boolean;
  viaFerrataMin: number;
  viaFerrataMax: number;
  hideMissingViaFerrata: boolean;
  excludeViaFerrata: boolean;
  iceClimbingMin: number;
  iceClimbingMax: number;
  hideMissingIceClimbing: boolean;
  excludeIceClimbing: boolean;
  snowshoeMin: number;
  snowshoeMax: number;
  hideMissingSnowshoe: boolean;
  excludeSnowshoe: boolean;
  driveMin: number;
  driveMax: number;
  hideMissingDrive: boolean;
  geodataOnly: boolean;
  persist: boolean;
}

export interface ListingMetadata {
  card: HTMLElement;
  footer?: HTMLElement;
  group: HTMLElement[];
  hikeGrade: number;
  climbGrade: number;
  mountaineeringGrade: number;
  skiGrade: number;
  mountainbikeGrade: number;
  viaFerrataGrade: number;
  iceClimbingGrade: number;
  snowshoeGrade: number;
  driveDuration: number;
  geodataCount: number | undefined;
}

interface FilterResult {
  visible: boolean;
  unknown: boolean;
}

const EXTRA_GRADE_FILTERS = [
  { key: "mountaineering", label: "Hochtouren", tours: "Hochtouren", min: "mountaineeringMin", max: "mountaineeringMax", hide: "hideMissingMountaineering", exclude: "excludeMountaineering", grade: "mountaineeringGrade", steps: SAC_FILTER_STEPS },
  { key: "ski", label: "Ski", tours: "Skitouren", min: "skiMin", max: "skiMax", hide: "hideMissingSki", exclude: "excludeSki", grade: "skiGrade", steps: SAC_FILTER_STEPS },
  { key: "mountainbike", label: "Mountainbike", tours: "Mountainbiketouren", min: "mountainbikeMin", max: "mountainbikeMax", hide: "hideMissingMountainbike", exclude: "excludeMountainbike", grade: "mountainbikeGrade", steps: MOUNTAINBIKE_FILTER_STEPS },
  { key: "via-ferrata", label: "Klettersteig", tours: "Klettersteigtouren", min: "viaFerrataMin", max: "viaFerrataMax", hide: "hideMissingViaFerrata", exclude: "excludeViaFerrata", grade: "viaFerrataGrade", steps: VIA_FERRATA_FILTER_STEPS },
  { key: "ice-climbing", label: "Eisklettern", tours: "Eisklettertouren", min: "iceClimbingMin", max: "iceClimbingMax", hide: "hideMissingIceClimbing", exclude: "excludeIceClimbing", grade: "iceClimbingGrade", steps: ICE_CLIMBING_FILTER_STEPS },
  { key: "snowshoe", label: "Schneeschuh", tours: "Schneeschuhtouren", min: "snowshoeMin", max: "snowshoeMax", hide: "hideMissingSnowshoe", exclude: "excludeSnowshoe", grade: "snowshoeGrade", steps: SNOWSHOE_FILTER_STEPS }
] as const;

function driveStep(minutes: number): GradeStep {
  if (minutes < 60) return { label: `${minutes} min`, value: minutes };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return { label: rest ? `${hours} h ${rest}` : `${hours} h`, value: minutes };
}

export const DRIVE_FILTER_STEPS: GradeStep[] = [
  ...Array.from({ length: 13 }, (_, index) => driveStep(index * 5)),
  ...Array.from({ length: 24 }, (_, index) => driveStep(70 + index * 10))
];

export const DEFAULT_LISTING_FILTER_STATE: ListingFilterState = {
  hikeMin: 0,
  hikeMax: HIKE_FILTER_STEPS.length - 1,
  hideMissingHike: false,
  climbMin: 0,
  climbMax: CLIMB_FILTER_STEPS.length - 1,
  hideMissingClimb: false,
  mountaineeringMin: 0,
  mountaineeringMax: SAC_FILTER_STEPS.length - 1,
  hideMissingMountaineering: false,
  excludeMountaineering: false,
  skiMin: 0,
  skiMax: SAC_FILTER_STEPS.length - 1,
  hideMissingSki: false,
  excludeSki: false,
  mountainbikeMin: 0,
  mountainbikeMax: MOUNTAINBIKE_FILTER_STEPS.length - 1,
  hideMissingMountainbike: false,
  excludeMountainbike: false,
  viaFerrataMin: 0,
  viaFerrataMax: VIA_FERRATA_FILTER_STEPS.length - 1,
  hideMissingViaFerrata: false,
  excludeViaFerrata: false,
  iceClimbingMin: 0,
  iceClimbingMax: ICE_CLIMBING_FILTER_STEPS.length - 1,
  hideMissingIceClimbing: false,
  excludeIceClimbing: false,
  snowshoeMin: 0,
  snowshoeMax: SNOWSHOE_FILTER_STEPS.length - 1,
  hideMissingSnowshoe: false,
  excludeSnowshoe: false,
  driveMin: 0,
  driveMax: DRIVE_FILTER_STEPS.length - 1,
  hideMissingDrive: false,
  geodataOnly: false,
  persist: false
};

const FADE_MS = 180;
const STORAGE_KEY = "hikr.ext.listingFilter.state";

let state: ListingFilterState = { ...DEFAULT_LISTING_FILTER_STATE };
let toursAppendedListenerInstalled = false;
let pipelineListenerInstalled = false;
let activeContext: FeatureContext | undefined;
let settingsListenerInstalled = false;

function visibleFilterState(value: ListingFilterState): ListingFilterState {
  const visible = resolveFilterVisibility(activeContext?.settings.filters);
  const next = { ...value };
  for (const filter of EXTRA_GRADE_FILTERS) {
    if (visible[filter.key]) continue;
    next[filter.min] = DEFAULT_LISTING_FILTER_STATE[filter.min];
    next[filter.max] = DEFAULT_LISTING_FILTER_STATE[filter.max];
    next[filter.hide] = false;
    next[filter.exclude] = false;
  }
  for (const [key, min, max, hide] of [
    ["hike", "hikeMin", "hikeMax", "hideMissingHike"],
    ["climb", "climbMin", "climbMax", "hideMissingClimb"],
    ["drive", "driveMin", "driveMax", "hideMissingDrive"]
  ] as const) {
    if (visible[key]) continue;
    next[min] = DEFAULT_LISTING_FILTER_STATE[min];
    next[max] = DEFAULT_LISTING_FILTER_STATE[max];
    next[hide] = false;
  }
  if (!visible.geodata) next.geodataOnly = false;
  return next;
}

export function updateListingFilterVisibility(filters?: Partial<FilterVisibility>, ranges: FilterSliderRangeInput | undefined = activeContext?.settings.filterSliderRanges): void {
  if (!activeContext) return;
  activeContext.settings.filters = resolveFilterVisibility(filters);
  activeContext.settings.filterSliderRanges = resolveFilterSliderRanges(ranges);
  state = visibleFilterState(state);
  syncPersistedState();
  const menu = activeContext.root.querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
  if (menu) {
    menu.innerHTML = menuHtml(activeContext);
    renderMenu(menu);
  } else applyListingFilter(state);
}

function installSettingsListener(): void {
  if (settingsListenerInstalled || typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    updateListingFilterVisibility(changes[SETTINGS_KEY].newValue?.filters,
      resolveFilterSliderRanges(changes[SETTINGS_KEY].newValue?.filterSliderRanges));
  });
  settingsListenerInstalled = true;
}

function isFilterActive(value: ListingFilterState): boolean {
  return EXTRA_GRADE_FILTERS.some((filter) => value[filter.exclude] || value[filter.hide]
    || value[filter.min] !== DEFAULT_LISTING_FILTER_STATE[filter.min]
    || value[filter.max] !== DEFAULT_LISTING_FILTER_STATE[filter.max])
    || value.geodataOnly
    || value.hideMissingHike
    || value.hideMissingClimb
    || value.hideMissingDrive
    || value.hikeMin !== DEFAULT_LISTING_FILTER_STATE.hikeMin
    || value.hikeMax !== DEFAULT_LISTING_FILTER_STATE.hikeMax
    || value.climbMin !== DEFAULT_LISTING_FILTER_STATE.climbMin
    || value.climbMax !== DEFAULT_LISTING_FILTER_STATE.climbMax
    || value.driveMin !== DEFAULT_LISTING_FILTER_STATE.driveMin
    || value.driveMax !== DEFAULT_LISTING_FILTER_STATE.driveMax;
}

function cloneDefaultState(): ListingFilterState {
  return { ...DEFAULT_LISTING_FILTER_STATE };
}

function clampIndex(value: unknown, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(Math.round(n), max));
}

function coerceState(value: Partial<ListingFilterState> | undefined): ListingFilterState {
  const next: ListingFilterState = {
    ...DEFAULT_LISTING_FILTER_STATE,
    hikeMin: clampIndex(value?.hikeMin, HIKE_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.hikeMin),
    hikeMax: clampIndex(value?.hikeMax, HIKE_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.hikeMax),
    hideMissingHike: Boolean(value?.hideMissingHike),
    climbMin: clampIndex(value?.climbMin, CLIMB_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.climbMin),
    climbMax: clampIndex(value?.climbMax, CLIMB_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.climbMax),
    hideMissingClimb: Boolean(value?.hideMissingClimb),
    driveMin: clampIndex(value?.driveMin, DRIVE_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.driveMin),
    driveMax: clampIndex(value?.driveMax, DRIVE_FILTER_STEPS.length - 1, DEFAULT_LISTING_FILTER_STATE.driveMax),
    hideMissingDrive: Boolean(value?.hideMissingDrive),
    geodataOnly: Boolean(value?.geodataOnly),
    persist: Boolean(value?.persist)
  };
  for (const filter of EXTRA_GRADE_FILTERS) {
    next[filter.min] = clampIndex(value?.[filter.min], filter.steps.length - 1, DEFAULT_LISTING_FILTER_STATE[filter.min]);
    next[filter.max] = clampIndex(value?.[filter.max], filter.steps.length - 1, DEFAULT_LISTING_FILTER_STATE[filter.max]);
    next[filter.hide] = Boolean(value?.[filter.hide]);
    next[filter.exclude] = Boolean(value?.[filter.exclude]);
  }
  return next;
}

function loadPersistedState(): ListingFilterState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ListingFilterState> & { version?: number };
    if ((parsed.version ?? 1) < 2) {
      // Old sliders stored indices of I..VIII; preserve their actual bounds.
      const oldMin = clampIndex(parsed.climbMin, 7, 0);
      const oldMax = clampIndex(parsed.climbMax, 7, 7);
      parsed.climbMin = CLIMB_FILTER_STEPS.findIndex((step) => step.value === (oldMin + 1) * 100);
      parsed.climbMax = oldMin === 0 && oldMax === 7 ? CLIMB_FILTER_STEPS.length - 1
        : CLIMB_FILTER_STEPS.findIndex((step) => step.value === (oldMax + 1) * 100);
    }
    if ((parsed.version ?? 1) < 3) {
      // T3+ was missing from the previous slider; retain saved grade boundaries.
      const oldMin = clampIndex(parsed.hikeMin, 11, 0);
      const oldMax = clampIndex(parsed.hikeMax, 11, 11);
      parsed.hikeMin = oldMin >= 3 ? oldMin + 1 : oldMin;
      parsed.hikeMax = oldMax >= 3 ? oldMax + 1 : oldMax;
    }
    const next = coerceState(parsed);
    return next.persist ? next : undefined;
  } catch {
    return undefined;
  }
}

function syncPersistedState(): void {
  try {
    if (state.persist) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 3 }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage can fail in private or restricted contexts */
  }
}

function isAuthorFooter(el: HTMLElement): boolean {
  const style = el.getAttribute("style") ?? "";
  const text = (el.textContent ?? "").replace(/\s+/g, " ");
  return /clear\s*:\s*both/i.test(style) || el.style.clear === "both" || /Publiziert von/i.test(text);
}

function findAuthorFooter(card: HTMLElement): HTMLElement | undefined {
  let node = card.nextSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? "").trim()) {
      node = node.nextSibling;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return undefined;
    const el = node as HTMLElement;
    if (el.classList.contains("content-list")) return undefined;
    return isAuthorFooter(el) ? el : undefined;
  }
  return undefined;
}

function readGeodataCount(footer: HTMLElement | undefined): number | undefined {
  if (!footer) return undefined;
  const text = (footer.textContent ?? "").replace(/\s+/g, " ");
  // Hikr uses Geodata in EN/IT and Géodonnées in FR, also in mixed-language
  // lists where additional pages were fetched by the background worker.
  const match = text.match(/\b(?:Geodaten|Geodata|Géodonnées)\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

// Footers are immutable. Grades and driving times may arrive asynchronously and
// must be read afresh on every filter pass (badge parsing is cached in sort-data).
type CachedListingMetadata = Pick<ListingMetadata, "footer" | "group" | "geodataCount">;
const metadataCache = new WeakMap<HTMLElement, CachedListingMetadata>();

function listingMetadataFor(card: HTMLElement): CachedListingMetadata {
  let cached = metadataCache.get(card);
  if (!cached) {
    const footer = findAuthorFooter(card);
    cached = {
      footer,
      group: footer ? [card, footer] : [card],
      geodataCount: readGeodataCount(footer)
    };
    metadataCache.set(card, cached);
  }
  return cached;
}

// Main-body listing cards only. hikr.org reuses the `.content-list` class for the
// right-column "In der Nähe" sidebar (wrapped in `.menu_right` / `#menu_rs_swiss`),
// so a document-wide `.content-list` sweep would wrongly mute/hide those sidebar
// entries and skew the visible/total count. We exclude by ancestry rather than scope
// to a positive main container: a missing/renamed positive container would fail
// *closed* (zero listings), whereas exclusion fails *open* (no sidebar -> unchanged
// behaviour) and can never hide a real main listing, since `.menu_right` /
// `#menu_rs_swiss` is by definition the sidebar. Every listing-filter DOM collection
// routes through here so "main listings only" is a single enforced rule.
function mainListingCards(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(".content-list")]
    .filter((card) => !card.closest(".menu_right, #menu_rs_swiss"));
}

function ensureFilterEnrichment(context: FeatureContext): void {
  // The filter may open after pagination has already appended more cards.
  // Include those URLs too, even if their badges currently hide the cards.
  const tourUrls = [...new Set([
    ...context.page.tourUrls,
    ...mainListingCards().flatMap((card) => collectHikrTourUrls(card, context.page.url))
  ])];
  if (tourUrls.length > 0) ensureEnrichmentPipeline({ ...context, page: { ...context.page, tourUrls } });
}

export function collectListingMetadata(root: ParentNode = document): ListingMetadata[] {
  return mainListingCards(root).map((card) => {
    const ranks = readCardGradeRanks(card);
    return {
      card,
      ...listingMetadataFor(card),
      hikeGrade: ranks.hikingGrade,
      climbGrade: ranks.climbingGrade,
      mountaineeringGrade: ranks.mountaineeringGrade,
      skiGrade: ranks.skiGrade,
      mountainbikeGrade: ranks.mountainbikeGrade,
      viaFerrataGrade: ranks.viaFerrataGrade,
      iceClimbingGrade: ranks.iceClimbingGrade,
      snowshoeGrade: ranks.snowshoeGrade,
      driveDuration: Number(card.dataset.hikrDriveDuration)
    };
  });
}

function minValue(steps: GradeStep[], index: number): number {
  return steps[Math.max(0, Math.min(index, steps.length - 1))].value;
}

function hasMainDriveData(): boolean {
  return mainListingCards().some((card) => card.dataset.hikrDriveDuration !== undefined);
}

function driveSectionAvailable(context: FeatureContext | undefined): boolean {
  return context?.page.pageType === "searchResults"
    || context?.page.pageType === "waypoint"
    || hasMainDriveData();
}

function driveFilterAvailable(context: FeatureContext | undefined): boolean {
  return driveSectionAvailable(context) && hasMainDriveData();
}

function matchesFilter(
  meta: ListingMetadata,
  value: ListingFilterState,
  canFilterDrive: boolean,
  canHideMissingDrive: boolean
): FilterResult {
  let unknown = false;
  const hikeActive = value.hikeMin !== DEFAULT_LISTING_FILTER_STATE.hikeMin || value.hikeMax !== DEFAULT_LISTING_FILTER_STATE.hikeMax;
  const climbActive = value.climbMin !== DEFAULT_LISTING_FILTER_STATE.climbMin || value.climbMax !== DEFAULT_LISTING_FILTER_STATE.climbMax;
  const driveActive = canFilterDrive && (
    value.driveMin !== DEFAULT_LISTING_FILTER_STATE.driveMin || value.driveMax !== DEFAULT_LISTING_FILTER_STATE.driveMax
  );

  if (hikeActive || value.hideMissingHike) {
    if (!Number.isFinite(meta.hikeGrade)) {
      if (value.hideMissingHike) return { visible: false, unknown: false };
      unknown = true;
    }
    else if (hikeActive && (meta.hikeGrade < minValue(HIKE_FILTER_STEPS, value.hikeMin) || meta.hikeGrade > minValue(HIKE_FILTER_STEPS, value.hikeMax))) {
      return { visible: false, unknown: false };
    }
  }

  if (climbActive || value.hideMissingClimb) {
    if (!Number.isFinite(meta.climbGrade)) {
      if (value.hideMissingClimb) return { visible: false, unknown: false };
      unknown = true;
    }
    else if (climbActive && (meta.climbGrade < minValue(CLIMB_FILTER_STEPS, value.climbMin) || meta.climbGrade > minValue(CLIMB_FILTER_STEPS, value.climbMax))) {
      return { visible: false, unknown: false };
    }
  }

  for (const filter of EXTRA_GRADE_FILTERS) {
    if (value[filter.exclude]) {
      if (Number.isFinite(meta[filter.grade])) return { visible: false, unknown: false };
      continue;
    }
    const active = value[filter.min] !== DEFAULT_LISTING_FILTER_STATE[filter.min]
      || value[filter.max] !== DEFAULT_LISTING_FILTER_STATE[filter.max];
    if (!active && !value[filter.hide]) continue;
    const grade = meta[filter.grade];
    if (!Number.isFinite(grade)) {
      if (value[filter.hide]) return { visible: false, unknown: false };
      unknown = true;
    } else if (active && (grade < minValue(filter.steps, value[filter.min]) || grade > minValue(filter.steps, value[filter.max]))) {
      return { visible: false, unknown: false };
    }
  }

  if (value.geodataOnly) {
    if (meta.geodataCount === undefined) unknown = true;
    else if (meta.geodataCount < 1) return { visible: false, unknown: false };
  }

  if ((driveActive || value.hideMissingDrive) && canHideMissingDrive) {
    if (!Number.isFinite(meta.driveDuration)) {
      if (value.hideMissingDrive) return { visible: false, unknown: false };
    }
    else if (driveActive && (meta.driveDuration < minValue(DRIVE_FILTER_STEPS, value.driveMin) || meta.driveDuration > minValue(DRIVE_FILTER_STEPS, value.driveMax))) {
      return { visible: false, unknown: false };
    }
  }

  return { visible: true, unknown };
}

function applyElementState(el: HTMLElement, result: FilterResult): void {
  const wasHidden = el.classList.contains("hikr-ext-listing-filter-hidden");
  el.classList.remove("hikr-ext-listing-filter-muted");
  if (!result.visible) {
    el.classList.add("hikr-ext-listing-filter-fade");
    if (wasHidden) {
      el.classList.add("hikr-ext-listing-filter-hidden");
      return;
    }
    window.setTimeout(() => {
      if (el.classList.contains("hikr-ext-listing-filter-fade")) el.classList.add("hikr-ext-listing-filter-hidden");
    }, FADE_MS);
    return;
  }
  el.classList.remove("hikr-ext-listing-filter-hidden", "hikr-ext-listing-filter-fade");
  if (result.unknown) el.classList.add("hikr-ext-listing-filter-muted");
}

export function applyListingFilter(value: ListingFilterState): { visible: number; total: number } {
  value = visibleFilterState(value);
  let visible = 0;
  const listings = collectListingMetadata();
  const canFilterDrive = driveFilterAvailable(activeContext);
  const canHideMissingDrive = driveSectionAvailable(activeContext);
  for (const meta of listings) {
    const result = matchesFilter(meta, value, canFilterDrive, canHideMissingDrive);
    if (result.visible) visible++;
    for (const el of meta.group) applyElementState(el, result);
  }
  updateFilterButtonState(isFilterActive(value));
  return { visible, total: listings.length };
}

export function resetListingFilterStateForTests(): void {
  state = cloneDefaultState();
  activeContext = undefined;
  updateFilterButtonState(false);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function updateFilterButtonState(active: boolean): void {
  document.querySelectorAll<HTMLElement>('[data-hikr-action="filter"]').forEach((button) => {
    button.classList.toggle("hikr-ext-filter-active", active);
  });
}

function rangeLabel(steps: GradeStep[], min: number, max: number): string {
  return `${steps[min].label} - ${steps[max].label}`;
}

function stepPercent(index: number, steps: GradeStep[]): string {
  if (steps.length < 2) return "0%";
  return `${(index / (steps.length - 1)) * 100}%`;
}

function setRangeVisual(menu: HTMLElement, range: string, min: number, max: number, steps: GradeStep[], lower = 0, upper = steps.length - 1): void {
  const el = menu.querySelector<HTMLElement>(`[data-hikr-range="${range}"]`);
  if (!el) return;
  const domain = steps.slice(lower, upper + 1);
  el.style.setProperty("--hikr-filter-start", stepPercent(min - lower, domain));
  el.style.setProperty("--hikr-filter-end", upper === lower ? "100%" : stepPercent(max - lower, domain));
}

function sliderDisplay(key: SliderKey) {
  const steps = SLIDER_SCALES[key];
  const range = resolveFilterSliderRanges(activeContext?.settings.filterSliderRanges)[key];
  const lower = steps.findIndex((step) => step.value === range.min);
  const upper = steps.findIndex((step) => step.value === range.max);
  const min = state[`${key}Min`];
  const max = state[`${key}Max`];
  const active = min !== 0 || max !== steps.length - 1;
  return {
    steps, active, custom: lower !== 0 || upper !== steps.length - 1,
    min: active ? min : lower, max: active ? max : upper,
    lower: active ? Math.min(lower, min) : lower,
    upper: active ? Math.max(upper, max) : upper,
    extended: active && (min < lower || max > upper)
  };
}

function renderCompactSlider(menu: HTMLElement, key: SliderKey): void {
  const display = sliderDisplay(key);
  const { steps, lower, upper, min, max } = display;
  for (const bound of ["min", "max"] as const) {
    const input = menu.querySelector<HTMLInputElement>(`[data-hikr-filter="${key}-${bound}"]`);
    if (!input) continue;
    input.min = String(lower);
    input.max = String(upper);
    input.value = String(bound === "min" ? min : max);
    input.disabled = lower === upper;
    input.setAttribute("aria-valuetext", steps[bound === "min" ? min : max].label);
  }
  setRangeVisual(menu, key, min, max, steps, lower, upper);
  const output = menu.querySelector<HTMLElement>(`[data-hikr-filter-output="${key}"]`);
  if (output) output.textContent = display.custom && !display.active ? "Alle" : rangeLabel(steps, min, max);
  const note = menu.querySelector<HTMLElement>(`[data-hikr-slider-note="${key}"]`);
  if (note) {
    note.hidden = !display.custom;
    note.textContent = display.extended ? "Slider für die gespeicherte Filterauswahl erweitert."
      : `Slider: ${rangeLabel(steps, lower, upper)}${display.active ? "" : " · noch keine Einschränkung"}`;
  }
  menu.querySelector<HTMLElement>(`[data-hikr-apply-range="${key}"]`)?.toggleAttribute("hidden", !display.custom || display.active);
}

function renderMenu(menu: HTMLElement, stats = applyListingFilter(state)): void {
  const hikeOutput = menu.querySelector<HTMLElement>('[data-hikr-filter-output="hike"]');
  const climbOutput = menu.querySelector<HTMLElement>('[data-hikr-filter-output="climb"]');
  const driveOutput = menu.querySelector<HTMLElement>('[data-hikr-filter-output="drive"]');
  const result = menu.querySelector<HTMLElement>('[data-hikr-filter-result]');
  const canFilterDrive = driveFilterAvailable(activeContext);
  if (hikeOutput) hikeOutput.textContent = rangeLabel(HIKE_FILTER_STEPS, state.hikeMin, state.hikeMax);
  if (climbOutput) climbOutput.textContent = rangeLabel(CLIMB_FILTER_STEPS, state.climbMin, state.climbMax);
  if (driveOutput) driveOutput.textContent = canFilterDrive
    ? rangeLabel(DRIVE_FILTER_STEPS, state.driveMin, state.driveMax)
    : "nach Berechnung";
  if (result) result.textContent = `${stats.visible} / ${stats.total}`;
  setRangeVisual(menu, "hike", state.hikeMin, state.hikeMax, HIKE_FILTER_STEPS);
  setRangeVisual(menu, "climb", state.climbMin, state.climbMax, CLIMB_FILTER_STEPS);
  setRangeVisual(menu, "drive", state.driveMin, state.driveMax, DRIVE_FILTER_STEPS);
  for (const filter of EXTRA_GRADE_FILTERS) {
    const output = menu.querySelector<HTMLElement>(`[data-hikr-filter-output="${filter.key}"]`);
    if (output) output.textContent = rangeLabel(filter.steps, state[filter.min], state[filter.max]);
    setRangeVisual(menu, filter.key, state[filter.min], state[filter.max], filter.steps);
    const min = menu.querySelector<HTMLInputElement>(`[data-hikr-filter="${filter.key}-min"]`);
    const max = menu.querySelector<HTMLInputElement>(`[data-hikr-filter="${filter.key}-max"]`);
    const hide = menu.querySelector<HTMLInputElement>(`[data-hikr-filter="hide-missing-${filter.key}"]`);
    const exclude = menu.querySelector<HTMLInputElement>(`[data-hikr-filter="exclude-${filter.key}"]`);
    if (min) min.value = String(state[filter.min]);
    if (max) max.value = String(state[filter.max]);
    if (hide) hide.checked = state[filter.hide];
    if (exclude) exclude.checked = state[filter.exclude];
    for (const input of [min, max, hide]) if (input) input.disabled = state[filter.exclude];
  }
  for (const input of menu.querySelectorAll<HTMLInputElement>("input[data-hikr-filter]")) {
    const key = input.dataset.hikrFilter;
    if (key === "hike-min") input.value = String(state.hikeMin);
    if (key === "hike-max") input.value = String(state.hikeMax);
    if (key === "hide-missing-hike") input.checked = state.hideMissingHike;
    if (key === "climb-min") input.value = String(state.climbMin);
    if (key === "climb-max") input.value = String(state.climbMax);
    if (key === "hide-missing-climb") input.checked = state.hideMissingClimb;
    if (key === "drive-min") {
      input.value = String(state.driveMin);
      input.disabled = !canFilterDrive;
    }
    if (key === "drive-max") {
      input.value = String(state.driveMax);
      input.disabled = !canFilterDrive;
    }
    if (key === "hide-missing-drive") input.checked = state.hideMissingDrive;
    if (key === "geodata") input.checked = state.geodataOnly;
    if (key === "persist") input.checked = state.persist;
  }
  menu.querySelector<HTMLElement>('[data-hikr-filter-drive-note]')?.toggleAttribute("hidden", canFilterDrive);
  renderCompactSlider(menu, "hike");
  renderCompactSlider(menu, "climb");
}

function syncRange(key: string): void {
  for (const filter of EXTRA_GRADE_FILTERS) {
    if (state[filter.min] <= state[filter.max]) continue;
    if (key === `${filter.key}-min`) state[filter.max] = state[filter.min];
    else state[filter.min] = state[filter.max];
  }
  if (state.hikeMin > state.hikeMax) {
    if (key === "hike-min") state.hikeMax = state.hikeMin;
    else state.hikeMin = state.hikeMax;
  }
  if (state.climbMin > state.climbMax) {
    if (key === "climb-min") state.climbMax = state.climbMin;
    else state.climbMin = state.climbMax;
  }
  if (state.driveMin > state.driveMax) {
    if (key === "drive-min") state.driveMax = state.driveMin;
    else state.driveMin = state.driveMax;
  }
}

function menuHtml(context: FeatureContext): string {
  const visible = resolveFilterVisibility(context.settings.filters);
  const extraGrades = EXTRA_GRADE_FILTERS.filter((filter) => visible[filter.key]).map((filter) => `
    <div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>${filter.label}</span><output data-hikr-filter-output="${filter.key}"></output></div>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="exclude-${filter.key}" />
        <span>${filter.tours} ausblenden</span>
      </label>
      <div class="hikr-ext-filter-range" data-hikr-range="${filter.key}">
        <input type="range" min="0" max="${filter.steps.length - 1}" step="1" data-hikr-filter="${filter.key}-min" aria-label="${filter.label}: minimale Schwierigkeit" />
        <input type="range" min="0" max="${filter.steps.length - 1}" step="1" data-hikr-filter="${filter.key}-max" aria-label="${filter.label}: maximale Schwierigkeit" />
      </div>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-${filter.key}" />
        <span>Einträge ohne ${filter.label}-Schwierigkeit ausblenden</span>
      </label>
    </div>`).join("");
  const driveSection = visible.drive && driveSectionAvailable(context)
    ? `<div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>Fahrtzeit</span><output data-hikr-filter-output="drive"></output></div>
      <div class="hikr-ext-filter-range" data-hikr-range="drive">
        <input type="range" min="0" max="${DRIVE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="drive-min" aria-label="Minimale Fahrtzeit" />
        <input type="range" min="0" max="${DRIVE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="drive-max" aria-label="Maximale Fahrtzeit" />
      </div>
      <div class="hikr-ext-filter-note" data-hikr-filter-drive-note>Der Fahrtzeitbereich greift erst bei berechneter Fahrtzeit.</div>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-drive" />
        <span>Einträge ohne Fahrtzeit ausblenden</span>
      </label>
    </div>`
    : "";
  return `
    <div class="hikr-ext-filter-head">
      <span>Filtern</span>
      <span class="hikr-ext-filter-result" data-hikr-filter-result></span>
    </div>
    ${visible.hike ? `<div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>Wandern</span><output data-hikr-filter-output="hike"></output></div>
      <div class="hikr-ext-filter-range" data-hikr-range="hike">
        <input type="range" min="0" max="${HIKE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="hike-min" aria-label="Minimale Wanderschwierigkeit" />
        <input type="range" min="0" max="${HIKE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="hike-max" aria-label="Maximale Wanderschwierigkeit" />
      </div>
      <div class="hikr-ext-filter-note" data-hikr-slider-note="hike" hidden></div>
      <button type="button" class="hikr-ext-filter-reset" data-hikr-apply-range="hike" hidden>Bereich anwenden</button>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-hike" />
        <span>Einträge ohne Wanderschwierigkeit ausblenden</span>
      </label>
    </div>` : ""}
    ${visible.climb ? `<div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>Klettern</span><output data-hikr-filter-output="climb"></output></div>
      <div class="hikr-ext-filter-range" data-hikr-range="climb">
        <input type="range" min="0" max="${CLIMB_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="climb-min" aria-label="Minimale Kletterschwierigkeit" />
        <input type="range" min="0" max="${CLIMB_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="climb-max" aria-label="Maximale Kletterschwierigkeit" />
      </div>
      <div class="hikr-ext-filter-note" data-hikr-slider-note="climb" hidden></div>
      <button type="button" class="hikr-ext-filter-reset" data-hikr-apply-range="climb" hidden>Bereich anwenden</button>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-climb" />
        <span>Einträge ohne Kletterschwierigkeit ausblenden</span>
      </label>
    </div>` : ""}
    ${extraGrades}
    ${visible.mountaineering || visible.ski || visible.mountainbike ? '<div class="hikr-ext-filter-note">Hochtouren, Ski und Mountainbike: L = F, WS = PD, ZS = AD, S = D, SS = TD/MD, AS = ED.</div>' : ""}
    ${visible["via-ferrata"] ? '<div class="hikr-ext-filter-note">Klettersteig: K1 = F bis K6 = ED.</div>' : ""}
    ${driveSection}
    ${visible.geodata ? `<label class="hikr-ext-filter-check">
      <input type="checkbox" data-hikr-filter="geodata" />
      <span>Nur mit Geodaten</span>
    </label>` : ""}
    <label class="hikr-ext-filter-check">
      <input type="checkbox" data-hikr-filter="persist" />
      <span>Filter dauerhaft anwenden und offen lassen</span>
    </label>
    <button type="button" class="hikr-ext-filter-reset" data-hikr-filter-reset>Zurücksetzen</button>
  `;
}

function installToursAppendedListener(root: HTMLElement): void {
  if (toursAppendedListenerInstalled) return;
  toursAppendedListenerInstalled = true;
  document.addEventListener(EVT_TOURS_APPENDED, () => {
    const menu = (activeContext?.root ?? root).querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
    const stats = applyListingFilter(state);
    if (menu) renderMenu(menu, stats);
  });
}

function installPipelineListener(root: HTMLElement): void {
  if (pipelineListenerInstalled) return;
  pipelineListenerInstalled = true;
  const refresh = () => {
    const menu = (activeContext?.root ?? root).querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
    const stats = applyListingFilter(state);
    if (menu) renderMenu(menu, stats);
  };
  onPipelineChange(refresh);
  document.addEventListener(EVT_TOUR_GRADES_CHANGED, refresh);
}

export function openListingFilterMenu(context: FeatureContext): void {
  activeContext = context;
  installSettingsListener();
  state = visibleFilterState(state);
  syncPersistedState();
  const root = context.root;
  const existing = root.querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
  if (existing) {
    existing.remove();
    return;
  }
  if (mainListingCards().length === 0) return;

  root.querySelector<HTMLElement>(".hikr-ext-sort-menu")?.remove();
  installToursAppendedListener(root);
  installPipelineListener(root);

  const host = root.querySelector<HTMLElement>(".hikr-ext-panel main") ?? root;
  const menu = document.createElement("div");
  menu.className = "hikr-ext-listing-filter-menu";
  menu.innerHTML = menuHtml(context);
  const buttonRow = host.querySelector<HTMLElement>(".hikr-ext-button-row");
  if (buttonRow) buttonRow.insertAdjacentElement("afterend", menu);
  else host.append(menu);
  renderMenu(menu);
  ensureFilterEnrichment(context);

  menu.addEventListener("input", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("input[data-hikr-filter]");
    if (!input) return;
    const key = input.dataset.hikrFilter ?? "";
    for (const filter of EXTRA_GRADE_FILTERS) {
      if (key === `${filter.key}-min`) state[filter.min] = Number(input.value);
      if (key === `${filter.key}-max`) state[filter.max] = Number(input.value);
      if (key === `hide-missing-${filter.key}`) state[filter.hide] = input.checked;
      if (key === `exclude-${filter.key}`) state[filter.exclude] = input.checked;
    }
    // Both handles use global grade indices even when the displayed domain is
    // shortened. On first interaction, adopt the other visible handle as well.
    for (const slider of ["hike", "climb"] as const) {
      if (key !== `${slider}-min` && key !== `${slider}-max`) continue;
      state[`${slider}Min`] = Number(menu.querySelector<HTMLInputElement>(`[data-hikr-filter="${slider}-min"]`)!.value);
      state[`${slider}Max`] = Number(menu.querySelector<HTMLInputElement>(`[data-hikr-filter="${slider}-max"]`)!.value);
    }
    if (key === "hide-missing-hike") state.hideMissingHike = input.checked;
    if (key === "hide-missing-climb") state.hideMissingClimb = input.checked;
    if (key === "drive-min") state.driveMin = Number(input.value);
    if (key === "drive-max") state.driveMax = Number(input.value);
    if (key === "hide-missing-drive") state.hideMissingDrive = input.checked;
    if (key === "geodata") state.geodataOnly = input.checked;
    if (key === "persist") state.persist = input.checked;
    syncRange(key);
    syncPersistedState();
    renderMenu(menu);
  });

  menu.addEventListener("change", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[type="checkbox"][data-hikr-filter]');
    if (!input) return;
    const key = input.dataset.hikrFilter ?? "";
    for (const filter of EXTRA_GRADE_FILTERS) {
      if (key === `hide-missing-${filter.key}`) state[filter.hide] = input.checked;
      if (key === `exclude-${filter.key}`) state[filter.exclude] = input.checked;
    }
    if (key === "geodata") state.geodataOnly = input.checked;
    if (key === "hide-missing-hike") state.hideMissingHike = input.checked;
    if (key === "hide-missing-climb") state.hideMissingClimb = input.checked;
    if (key === "hide-missing-drive") state.hideMissingDrive = input.checked;
    if (key === "persist") state.persist = input.checked;
    syncPersistedState();
    renderMenu(menu);
  });

  menu.addEventListener("click", (event) => {
    const apply = (event.target as HTMLElement).closest<HTMLElement>("[data-hikr-apply-range]");
    const key = apply?.dataset.hikrApplyRange;
    if (key === "hike" || key === "climb") {
      const display = sliderDisplay(key);
      state[`${key}Min`] = display.lower;
      state[`${key}Max`] = display.upper;
      syncPersistedState();
      renderMenu(menu);
      return;
    }
    const reset = (event.target as HTMLElement).closest("[data-hikr-filter-reset]");
    if (!reset) return;
    state = { ...cloneDefaultState(), persist: state.persist };
    syncPersistedState();
    renderMenu(menu);
  });
}

export function initializeListingFilter(context: FeatureContext): void {
  activeContext = context;
  installSettingsListener();
  const persisted = loadPersistedState() ?? (state.persist ? state : undefined);
  if (!persisted) return;
  state = visibleFilterState(persisted);
  syncPersistedState();
  installToursAppendedListener(context.root);
  installPipelineListener(context.root);
  ensureFilterEnrichment(context);
  if (context.root.querySelector(".hikr-ext-panel")) openListingFilterMenu(context);
  else applyListingFilter(state);
}
