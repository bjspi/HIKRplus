import { absoluteUrl, isTourUrl, normalizeHikrUrl } from "../../shared/url";
import {
  type SortDir,
  buildSortGridHtml,
  criterionLabel,
  isDriveKey
} from "../../shared/sort";
import type { FeatureContext } from "../feature-types";
import { isIdle, onPipelineChange } from "../pipeline-status";
import { ensureAllCardGrades, hasDriveData, sortCards } from "../sort-data";
import { ensureEnrichmentPipeline, enrichVisibleTours } from "./tour-details";
import { startAutoRouting } from "./routes";

let activeKey = "";
let activeDir: SortDir = "asc";

// Tour URLs from every card currently in the DOM, including pages added by the
// pagination loader after the initial render.
function visibleTourUrls(): string[] {
  const urls = new Set<string>();
  document.querySelectorAll<HTMLElement>(".content-list a[href]").forEach((anchor) => {
    const absolute = absoluteUrl(anchor.getAttribute("href") ?? "", location.href);
    if (isTourUrl(absolute)) urls.add(normalizeHikrUrl(absolute));
  });
  return [...urls];
}

// Only tours that have NOT been rendered yet. Re-rendering an already-enriched card
// would overwrite its .hikr-ext-tour-details innerHTML and destroy the route pill
// that routes.ts appended there; already-rendered cards also already carry their
// sort-data attributes, so there is nothing to gain from re-enriching them.
function toursNeedingEnrichment(): string[] {
  const done = new Set<string>();
  document.querySelectorAll<HTMLElement>(".hikr-ext-tour-details:not(.hikr-ext-tour-pending)").forEach((details) => {
    const url = details.dataset.tourUrl;
    if (url) done.add(normalizeHikrUrl(url));
  });
  return visibleTourUrls().filter((url) => !done.has(url));
}

function renderList(menu: HTMLElement): void {
  const list = menu.querySelector<HTMLElement>(".hikr-ext-sort-list");
  if (list) list.innerHTML = buildSortGridHtml(activeKey, activeDir, hasDriveData());
  const note = menu.querySelector<HTMLElement>(".hikr-ext-sort-note");
  if (note) note.hidden = hasDriveData();
}

export function openSortMenu(context: FeatureContext): void {
  // Seed from the configured default the first time the menu is opened.
  if (!activeKey) {
    activeKey = context.settings.sort.key;
    activeDir = context.settings.sort.dir;
  }

  const root = context.root;
  const existing = root.querySelector<HTMLElement>(".hikr-ext-sort-menu");
  if (existing) {
    existing.remove();
    return;
  }
  const host = root.querySelector<HTMLElement>(".hikr-ext-panel main") ?? root;

  // Grades come straight from the list markup; make them available immediately.
  ensureAllCardGrades();
  // Detail-based keys need the tour pages fetched (cached if already loaded). Warm
  // the cache now so a sort click resolves quickly.
  const enrich = () =>
    enrichVisibleTours(toursNeedingEnrichment(), false, {
      waypointGmapsLinks: context.settings.ui.waypointGmapsLinks
    }).catch(() => undefined);
  let enrichPromise = enrich();

  const menu = document.createElement("div");
  menu.className = "hikr-ext-sort-menu";
  menu.innerHTML = `
    <div class="hikr-ext-sort-head">Sortieren nach</div>
    <div class="hikr-ext-sort-list"></div>
    <div class="hikr-ext-sort-note">Fahrtzeit / Fahrtstrecke nach Routenberechnung verfügbar</div>
  `;
  const buttonRow = host.querySelector<HTMLElement>(".hikr-ext-button-row");
  if (buttonRow) buttonRow.insertAdjacentElement("afterend", menu);
  else host.append(menu);
  renderList(menu);

  void enrichPromise.then(() => {
    if (menu.isConnected) renderList(menu);
  });

  menu.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-sort-key]");
    if (!button) return;
    const key = button.dataset.sortKey ?? "";
    if (key === activeKey) activeDir = activeDir === "asc" ? "desc" : "asc";
    else {
      activeKey = key;
      activeDir = "asc";
    }
    menu.classList.add("hikr-ext-sort-busy");
    // Re-enrich in case more pages were appended since the menu opened.
    enrichPromise = enrich();
    await enrichPromise;
    sortCards(activeKey, activeDir);
    menu.classList.remove("hikr-ext-sort-busy");
    renderList(menu);
  });

  // Close when clicking elsewhere (but not on the Sortieren button, which toggles).
  const onOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (menu.contains(target) || target.closest('[data-hikr-action="sort"]')) return;
    menu.remove();
    document.removeEventListener("click", onOutside, true);
  };
  setTimeout(() => document.addEventListener("click", onOutside, true), 0);
}

// ---------------------------------------------------------------------------
// Automatic sort: when enabled, wait for the WHOLE pipeline (pagination + every
// tour's enrichment + every driving time) to come to rest, then sort once. A
// spinner in the overlay communicates that it is still loading until then.
// ---------------------------------------------------------------------------

function autosortIndicator(root: HTMLElement): HTMLElement | undefined {
  const host = root.querySelector<HTMLElement>(".hikr-ext-panel main");
  if (!host) return undefined;
  let el = host.querySelector<HTMLElement>(".hikr-ext-autosort");
  if (!el) {
    el = document.createElement("div");
    el.className = "hikr-ext-autosort";
    const buttonRow = host.querySelector<HTMLElement>(".hikr-ext-button-row");
    if (buttonRow) buttonRow.insertAdjacentElement("beforebegin", el);
    else host.prepend(el);
  }
  return el;
}

function arrow(dir: SortDir): string {
  return dir === "asc" ? "▲" : "▼";
}

export function runAutoSort(context: FeatureContext): void {
  const { sort } = context.settings;
  if (!sort.auto) return;

  activeKey = sort.key;
  activeDir = sort.dir;

  // Make sure the data we need is actually being produced.
  ensureEnrichmentPipeline(context);
  if (isDriveKey(sort.key)) startAutoRouting(context); // driving times are required for this key

  const label = criterionLabel(sort.key);
  const indicator = autosortIndicator(context.root);
  const setLoading = () => {
    if (indicator) {
      indicator.classList.add("hikr-ext-autosort-loading");
      indicator.innerHTML = `<span class="hikr-ext-sort-spinner" aria-hidden="true"></span> Sortiere nach <b>${label}</b> … <span class="hikr-ext-autosort-hint">(lädt${isDriveKey(sort.key) ? " Fahrtzeiten" : ""})</span>`;
    }
  };
  const setDone = () => {
    if (indicator) {
      indicator.classList.remove("hikr-ext-autosort-loading");
      indicator.innerHTML = `↕ Sortiert nach <b>${label}</b> ${arrow(activeDir)}`;
    }
  };

  setLoading();

  let sorted = false;
  const finish = () => {
    if (sorted || !isIdle()) return;
    sorted = true;
    unsubscribe();
    sortCards(activeKey, activeDir);
    setDone();
  };
  const unsubscribe = onPipelineChange(finish);
  // In case the pipeline is somehow already idle by the time we subscribe.
  finish();
}
