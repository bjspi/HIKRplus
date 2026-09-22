import type { RouteResult, TourCacheRecord } from "../shared/types";
import { DIFFICULTY_DATA_KEYS, DIFFICULTY_FIELDS, difficultyRank, parseListingDifficulties, type DifficultyField } from "../shared/difficulty";
import {
  type SortDir,
  compareValues,
  parseDurationMinutes,
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

export const EVT_TOUR_GRADES_CHANGED = "hikr:ext:tour-grades-changed";
type GradeRanks = Record<DifficultyField, number>;
const badgeRanks = new WeakMap<HTMLElement, GradeRanks>();
const tourRanks = new WeakMap<HTMLElement, GradeRanks>();

export function readCardGradeRanks(card: HTMLElement): GradeRanks {
  const details = tourRanks.get(card);
  if (details) return details;
  let ranks = badgeRanks.get(card);
  if (!ranks) {
    const grades = parseListingDifficulties(card);
    ranks = Object.fromEntries(DIFFICULTY_FIELDS.map((field) => [field, difficultyRank(field, grades[field])])) as GradeRanks;
    badgeRanks.set(card, ranks);
  }
  return ranks;
}

export function writeCardGrades(card: HTMLElement): void {
  const ranks = readCardGradeRanks(card);
  for (const field of DIFFICULTY_FIELDS) setNum(card, DIFFICULTY_DATA_KEYS[field], ranks[field]);
}

export function ensureAllCardGrades(): void {
  document.querySelectorAll<HTMLElement>(".content-list").forEach(writeCardGrades);
}

// Detail-based values come from the enriched tour record.
export function writeTourSortData(card: HTMLElement, tour: TourCacheRecord): void {
  tourRanks.set(card, Object.fromEntries(DIFFICULTY_FIELDS.map((field) => [field, difficultyRank(field, tour[field])])) as GradeRanks);
  writeCardGrades(card);
  setNum(card, "hikrAscent", parseMeters(tour.heightGain));
  setNum(card, "hikrDescent", parseMeters(tour.heightLoss));
  setNum(card, "hikrDistance", parseKm(tour.routeLength));
  setNum(card, "hikrDuration", parseDurationMinutes(tour.tourDuration));
  setNum(card, "hikrMaxElevation", tour.maxElevation ?? Number.NaN);
  setNum(card, "hikrDate", parseIsoDate(tour.dateOfHike));
  document.dispatchEvent(new Event(EVT_TOUR_GRADES_CHANGED));
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
  // Main listings only. This document-wide `.content-list` sweep also matches the
  // right-column "In der Nähe" sidebar (`.menu_right` / `#menu_rs_swiss`), but sort is
  // only reachable on `searchResults` pages, which have no such sidebar — so it is not
  // a live bug today. If sort ever runs on pages with `.menu_right`, scope this (and
  // `ensureAllCardGrades`) the same way listing-filter's `mainListingCards` does.
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
