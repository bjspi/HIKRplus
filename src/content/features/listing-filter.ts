import { parseClimbGrade, parseHikeGrade } from "../../shared/sort";
import type { FeatureContext } from "../feature-types";
import { EVT_TOURS_APPENDED, onPipelineChange } from "../pipeline-status";

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
  driveDuration: number;
  geodataCount: number | undefined;
}

interface FilterResult {
  visible: boolean;
  unknown: boolean;
}

export const HIKE_FILTER_STEPS: GradeStep[] = [
  { label: "T1", value: 1 },
  { label: "T2", value: 2 },
  { label: "T3", value: 3 },
  { label: "T4-", value: 3.7 },
  { label: "T4", value: 4 },
  { label: "T4+", value: 4.3 },
  { label: "T5-", value: 4.7 },
  { label: "T5", value: 5 },
  { label: "T5+", value: 5.3 },
  { label: "T6-", value: 5.7 },
  { label: "T6", value: 6 },
  { label: "T6+", value: 6.3 }
];

export const CLIMB_FILTER_STEPS: GradeStep[] = [
  { label: "I", value: 1 },
  { label: "II", value: 2 },
  { label: "III", value: 3 },
  { label: "IV", value: 4 },
  { label: "V", value: 5 },
  { label: "VI", value: 6 },
  { label: "VII", value: 7 },
  { label: "VIII", value: 8 }
];

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

function isFilterActive(value: ListingFilterState): boolean {
  return value.geodataOnly
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
  return {
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
}

function loadPersistedState(): ListingFilterState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ListingFilterState>;
    const next = coerceState(parsed);
    return next.persist ? next : undefined;
  } catch {
    return undefined;
  }
}

function syncPersistedState(): void {
  try {
    if (state.persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage can fail in private or restricted contexts */
  }
}

function styleHasBadgeWidth(style: string): boolean {
  return style.replace(/\s/g, "").includes("width:30px");
}

function readGrades(card: HTMLElement): { hikeGrade: number; climbGrade: number } {
  let hikeGrade = Number.NaN;
  let climbGrade = Number.NaN;
  for (const span of card.querySelectorAll<HTMLElement>("span[style]")) {
    if (!styleHasBadgeWidth(span.getAttribute("style") ?? "")) continue;
    const text = (span.textContent ?? "").trim();
    if (Number.isNaN(hikeGrade) && /^T\s*\d\s*[+-]?$/i.test(text)) hikeGrade = parseHikeGrade(text);
    else if (Number.isNaN(climbGrade) && /^[IVX]+\s*[+-]?$/i.test(text)) climbGrade = parseClimbGrade(text);
  }
  return { hikeGrade, climbGrade };
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
  const match = text.match(/Geodaten\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

// The expensive, immutable-per-card parts of the metadata: badge parsing, the
// footer sibling-walk and the geodata-text read. These never change for a given
// card once HIKR has rendered it, so they are cached and reused across the many
// applyListingFilter() calls a single slider drag fires. driveDuration is the one
// dynamic field (the routing pipeline writes it asynchronously after the fact), so
// it is deliberately read live below rather than cached.
type CachedListingMetadata = Omit<ListingMetadata, "card" | "driveDuration">;
const metadataCache = new WeakMap<HTMLElement, CachedListingMetadata>();

function listingMetadataFor(card: HTMLElement): CachedListingMetadata {
  let cached = metadataCache.get(card);
  if (!cached) {
    const footer = findAuthorFooter(card);
    const { hikeGrade, climbGrade } = readGrades(card);
    cached = {
      footer,
      group: footer ? [card, footer] : [card],
      hikeGrade,
      climbGrade,
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

export function collectListingMetadata(root: ParentNode = document): ListingMetadata[] {
  return mainListingCards(root).map((card) => ({
    card,
    ...listingMetadataFor(card),
    driveDuration: Number(card.dataset.hikrDriveDuration)
  }));
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
    else if (meta.hikeGrade < minValue(HIKE_FILTER_STEPS, value.hikeMin) || meta.hikeGrade > minValue(HIKE_FILTER_STEPS, value.hikeMax)) {
      return { visible: false, unknown: false };
    }
  }

  if (climbActive || value.hideMissingClimb) {
    if (!Number.isFinite(meta.climbGrade)) {
      if (value.hideMissingClimb) return { visible: false, unknown: false };
      unknown = true;
    }
    else if (meta.climbGrade < minValue(CLIMB_FILTER_STEPS, value.climbMin) || meta.climbGrade > minValue(CLIMB_FILTER_STEPS, value.climbMax)) {
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

function setRangeVisual(menu: HTMLElement, range: string, min: number, max: number, steps: GradeStep[]): void {
  const el = menu.querySelector<HTMLElement>(`[data-hikr-range="${range}"]`);
  if (!el) return;
  el.style.setProperty("--hikr-filter-start", stepPercent(min, steps));
  el.style.setProperty("--hikr-filter-end", stepPercent(max, steps));
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
}

function syncRange(key: string): void {
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
  const driveSection = driveSectionAvailable(context)
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
    <div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>Wandern</span><output data-hikr-filter-output="hike"></output></div>
      <div class="hikr-ext-filter-range" data-hikr-range="hike">
        <input type="range" min="0" max="${HIKE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="hike-min" aria-label="Minimale Wanderschwierigkeit" />
        <input type="range" min="0" max="${HIKE_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="hike-max" aria-label="Maximale Wanderschwierigkeit" />
      </div>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-hike" />
        <span>Einträge ohne Wanderschwierigkeit ausblenden</span>
      </label>
    </div>
    <div class="hikr-ext-filter-section">
      <div class="hikr-ext-filter-label"><span>Klettern</span><output data-hikr-filter-output="climb"></output></div>
      <div class="hikr-ext-filter-range" data-hikr-range="climb">
        <input type="range" min="0" max="${CLIMB_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="climb-min" aria-label="Minimale Kletterschwierigkeit" />
        <input type="range" min="0" max="${CLIMB_FILTER_STEPS.length - 1}" step="1" data-hikr-filter="climb-max" aria-label="Maximale Kletterschwierigkeit" />
      </div>
      <label class="hikr-ext-filter-subcheck">
        <input type="checkbox" data-hikr-filter="hide-missing-climb" />
        <span>Einträge ohne Kletterschwierigkeit ausblenden</span>
      </label>
    </div>
    ${driveSection}
    <label class="hikr-ext-filter-check">
      <input type="checkbox" data-hikr-filter="geodata" />
      <span>Nur mit Geodaten</span>
    </label>
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
    const menu = root.querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
    const stats = applyListingFilter(state);
    if (menu) renderMenu(menu, stats);
  });
}

function installPipelineListener(root: HTMLElement): void {
  if (pipelineListenerInstalled) return;
  pipelineListenerInstalled = true;
  onPipelineChange(() => {
    const menu = root.querySelector<HTMLElement>(".hikr-ext-listing-filter-menu");
    const stats = applyListingFilter(state);
    if (menu) renderMenu(menu, stats);
  });
}

export function openListingFilterMenu(context: FeatureContext): void {
  activeContext = context;
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

  menu.addEventListener("input", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("input[data-hikr-filter]");
    if (!input) return;
    const key = input.dataset.hikrFilter ?? "";
    if (key === "hike-min") state.hikeMin = Number(input.value);
    if (key === "hike-max") state.hikeMax = Number(input.value);
    if (key === "hide-missing-hike") state.hideMissingHike = input.checked;
    if (key === "climb-min") state.climbMin = Number(input.value);
    if (key === "climb-max") state.climbMax = Number(input.value);
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
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-hikr-filter="geodata"], input[data-hikr-filter="hide-missing-hike"], input[data-hikr-filter="hide-missing-climb"], input[data-hikr-filter="hide-missing-drive"], input[data-hikr-filter="persist"]');
    if (!input) return;
    const key = input.dataset.hikrFilter ?? "";
    if (key === "geodata") state.geodataOnly = input.checked;
    if (key === "hide-missing-hike") state.hideMissingHike = input.checked;
    if (key === "hide-missing-climb") state.hideMissingClimb = input.checked;
    if (key === "hide-missing-drive") state.hideMissingDrive = input.checked;
    if (key === "persist") state.persist = input.checked;
    syncPersistedState();
    renderMenu(menu);
  });

  menu.addEventListener("click", (event) => {
    const reset = (event.target as HTMLElement).closest("[data-hikr-filter-reset]");
    if (!reset) return;
    state = { ...cloneDefaultState(), persist: state.persist };
    syncPersistedState();
    renderMenu(menu);
  });
}

export function initializeListingFilter(context: FeatureContext): void {
  activeContext = context;
  const persisted = loadPersistedState() ?? (state.persist ? state : undefined);
  if (!persisted) return;
  state = persisted;
  installToursAppendedListener(context.root);
  installPipelineListener(context.root);
  if (context.root.querySelector(".hikr-ext-panel")) openListingFilterMenu(context);
  else applyListingFilter(state);
}
