// Pure, DOM-free sorting helpers shared between the content script (overlay sort
// menu + DOM reordering) and the options page (default-sort picker). Keeping this
// free of `document` access means it is unit-testable and safe to import anywhere.

export type SortDir = "asc" | "desc";

export interface SortCriterion {
  key: string;     // dataset key on the card, e.g. "hikrAscent" (data-hikr-ascent)
  label: string;   // German UI label
  drive?: boolean; // requires computed route data (auto or manual)
}

export const SORT_CRITERIA: SortCriterion[] = [
  { key: "hikrDate", label: "Datum" },
  { key: "hikrGradeHike", label: "Wanderschwierigkeit" },
  { key: "hikrGradeClimb", label: "Kletterschwierigkeit" },
  { key: "hikrMaxElevation", label: "Höchster Gipfel" },
  { key: "hikrAscent", label: "Anstieg" },
  { key: "hikrDescent", label: "Abstieg" },
  { key: "hikrDistance", label: "Strecke" },
  { key: "hikrDuration", label: "Dauer" },
  { key: "hikrDriveDuration", label: "Fahrtzeit", drive: true },
  { key: "hikrDriveDistance", label: "Fahrtstrecke", drive: true }
];

export const DEFAULT_SORT: { key: string; dir: SortDir } = { key: "hikrDate", dir: "desc" };

export function isDriveKey(key: string): boolean {
  return SORT_CRITERIA.some((c) => c.key === key && c.drive);
}

export function criterionLabel(key: string): string {
  return SORT_CRITERIA.find((c) => c.key === key)?.label ?? key;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };

function modifier(sign: string | undefined): number {
  return sign === "+" ? 0.3 : sign === "-" ? -0.3 : 0;
}

function leadingNumber(value: string | undefined): number {
  if (!value) return Number.NaN;
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : Number.NaN;
}

export function parseMeters(value?: string): number {
  return leadingNumber(value);
}

export function parseKm(value?: string): number {
  if (!value) return Number.NaN;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  return match ? Number(match[1].replace(",", ".")) : Number.NaN;
}

export function parseDurationMinutes(value?: string): number {
  if (!value) return Number.NaN;
  const hm = value.match(/(\d+):(\d{2})/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const days = value.match(/(\d+)\s*Tag/i);
  if (days) return Number(days[1]) * 24 * 60;
  return Number.NaN;
}

// T1 (easy) .. T6+ (hard); "-" is easier than plain, "+" is harder.
export function parseHikeGrade(value?: string): number {
  if (!value) return Number.NaN;
  const m = value.trim().match(/^T\s*(\d)\s*([+-]?)/i);
  return m ? Number(m[1]) + modifier(m[2]) : Number.NaN;
}

// Roman climbing grades I < II < III ...; "-" easier, "+" harder.
export function parseClimbGrade(value?: string): number {
  if (!value) return Number.NaN;
  const m = value.trim().match(/^([IVX]+)\s*([+-]?)$/i);
  if (!m) return Number.NaN;
  const base = ROMAN[m[1].toUpperCase()];
  return base ? base + modifier(m[2]) : Number.NaN;
}

export function parseIsoDate(value?: string): number {
  if (!value) return Number.NaN;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(`${m[1]}${m[2]}${m[3]}`) : Number.NaN;
}

// Comparator that always pushes missing/NaN values to the end, in both directions.
export function compareValues(a: number, b: number, dir: SortDir): number {
  const aOk = Number.isFinite(a);
  const bOk = Number.isFinite(b);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return dir === "asc" ? a - b : b - a;
}

// Shared markup for the criterion grid (overlay menu + options page). Buttons carry
// data-sort-key; the active one shows a ▲/▼ arrow for the current direction.
export function buildSortGridHtml(activeKey: string, activeDir: SortDir, includeDrive: boolean): string {
  return SORT_CRITERIA
    .filter((c) => !c.drive || includeDrive)
    .map((c) => {
      const active = c.key === activeKey;
      const arrow = active ? (activeDir === "asc" ? "▲" : "▼") : "";
      return `<button type="button" class="hikr-ext-sort-item${active ? " hikr-ext-sort-active" : ""}" data-sort-key="${c.key}"><span>${c.label}</span><span class="hikr-ext-sort-arrow" aria-hidden="true">${arrow}</span></button>`;
    })
    .join("");
}
