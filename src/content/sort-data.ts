import type { RouteResult, TourCacheRecord } from "../shared/types";
import {
  type SortDir,
  compareValues,
  parseClimbGrade,
  parseDurationMinutes,
  parseHikeGrade,
  parseIsoDate,
  parseKm,
  parseMeters
} from "../shared/sort";

// Sortable values are stored as numeric data-hikr-* attributes on each .content-list
// card. Keys are dataset (camelCase) keys, e.g. "hikrAscent" -> data-hikr-ascent.

function setNum(card: HTMLElement, key: string, value: number): void {
  if (Number.isFinite(value)) card.dataset[key] = String(value);
  else delete card.dataset[key];
}

// Grades live in the original list markup (not always present), so they can be read
// without fetching/enriching the individual tour pages. The grade badges are the
// small "width:30px" coloured spans; we classify them by text shape (T-scale vs.
// roman climbing grade) rather than colour, so it is language-independent and
// ignores the mountainbike badge (single letters L/M/S).
export function writeCardGrades(card: HTMLElement): void {
  let hike = Number.NaN;
  let climb = Number.NaN;
  for (const span of card.querySelectorAll<HTMLElement>("span[style]")) {
    if (!(span.getAttribute("style") ?? "").replace(/\s/g, "").includes("width:30px")) continue;
    const text = (span.textContent ?? "").trim();
    if (Number.isNaN(hike) && /^T\s*\d/i.test(text)) hike = parseHikeGrade(text);
    else if (Number.isNaN(climb) && /^[IVX]+\s*[+-]?$/i.test(text)) climb = parseClimbGrade(text);
  }
  setNum(card, "hikrGradeHike", hike);
  setNum(card, "hikrGradeClimb", climb);
}

export function ensureAllCardGrades(): void {
  document.querySelectorAll<HTMLElement>(".content-list").forEach(writeCardGrades);
}

// Detail-based values come from the enriched tour record.
export function writeTourSortData(card: HTMLElement, tour: TourCacheRecord): void {
  setNum(card, "hikrAscent", parseMeters(tour.heightGain));
  setNum(card, "hikrDescent", parseMeters(tour.heightLoss));
  setNum(card, "hikrDistance", parseKm(tour.routeLength));
  setNum(card, "hikrDuration", parseDurationMinutes(tour.tourDuration));
  setNum(card, "hikrMaxElevation", tour.maxElevation ?? Number.NaN);
  setNum(card, "hikrDate", parseIsoDate(tour.dateOfHike));
}

export function writeDriveSortData(card: HTMLElement | null | undefined, route: RouteResult): void {
  if (!card) return;
  setNum(card, "hikrDriveDistance", route.distanceMeters / 1000);
  setNum(card, "hikrDriveDuration", route.durationSeconds / 60);
}

// A card "group" is the .content-list element plus the sibling nodes that visually
// belong to it (the author/footer div, whitespace) up to the next card. Stops at
// structural elements so the page header, scripts and the pager are left untouched.
function collectGroup(card: HTMLElement): Node[] {
  const nodes: Node[] = [card];
  let node = card.nextSibling;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("content-list")) break;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") break;
      if (el.classList.contains("navigator") || el.classList.contains("hikr-ext-extra-page")) break;
    }
    nodes.push(node);
    node = node.nextSibling;
  }
  return nodes;
}

export function sortCards(key: string, dir: SortDir): void {
  ensureAllCardGrades();
  const cards = [...document.querySelectorAll<HTMLElement>(".content-list")];
  if (cards.length < 2) return;
  const target = cards[0].parentElement;
  if (!target) return;
  const groups = cards.map((card) => ({ group: collectGroup(card), value: Number(card.dataset[key]) }));
  groups.sort((a, b) => compareValues(a.value, b.value, dir));
  for (const { group } of groups) {
    for (const node of group) target.appendChild(node);
  }
  // Pagination pages were merged into the main container; drop the empty wrappers.
  document.querySelectorAll<HTMLElement>(".hikr-ext-extra-page").forEach((wrap) => {
    if (!wrap.querySelector(".content-list")) wrap.remove();
  });
}

export function hasDriveData(): boolean {
  return Boolean(document.querySelector(".content-list[data-hikr-drive-duration]"));
}
