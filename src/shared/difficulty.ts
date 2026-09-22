// Hikr labels and grades verified on its DE/EN/IT/FR tour pages and search form.
// Classify the discipline first: L/WS/ZS/S/SS are shared by three different scales.
export const DIFFICULTY_FIELDS = ["hikingGrade", "mountaineeringGrade", "climbingGrade", "skiGrade", "mountainbikeGrade", "viaFerrataGrade", "iceClimbingGrade", "snowshoeGrade"] as const;
export type DifficultyField = typeof DIFFICULTY_FIELDS[number];
export type TourDifficulties = Partial<Record<DifficultyField, string>>;

export const DIFFICULTY_LABELS: Record<DifficultyField, string> = {
  hikingGrade: "Wandern", mountaineeringGrade: "Hochtouren", climbingGrade: "Klettern",
  skiGrade: "Ski", mountainbikeGrade: "Mountainbike", viaFerrataGrade: "Klettersteig",
  iceClimbingGrade: "Eisklettern", snowshoeGrade: "Schneeschuh"
};

export const DIFFICULTY_DATA_KEYS: Record<DifficultyField, string> = {
  hikingGrade: "hikrGradeHike", mountaineeringGrade: "hikrGradeMountaineering",
  climbingGrade: "hikrGradeClimb", skiGrade: "hikrGradeSki", mountainbikeGrade: "hikrGradeMountainbike",
  viaFerrataGrade: "hikrGradeViaFerrata", iceClimbingGrade: "hikrGradeIceClimbing", snowshoeGrade: "hikrGradeSnowshoe"
};

const LABELS: Record<DifficultyField, string[]> = {
  hikingGrade: ["Wandern Schwierigkeit", "Hiking grading", "Hiking grade", "Difficoltà escursionismo", "Difficulté randonnée"],
  mountaineeringGrade: ["Hochtouren Schwierigkeit", "Mountaineering grading", "Mountaineering grade", "Difficoltà alta montagna", "Difficulté haute montagne"],
  climbingGrade: ["Klettern Schwierigkeit", "Climbing grading", "Climbing grade", "Difficoltà arrampicata", "Difficulté escalade"],
  skiGrade: ["Ski Schwierigkeit", "Ski grading", "Ski grade", "Difficoltà sci", "Difficulté ski"],
  mountainbikeGrade: ["Mountainbike Schwierigkeit", "Mountain-bike grading", "Mountain-bike grade", "Difficoltà Mountain-bike", "Difficulté VTT"],
  viaFerrataGrade: ["Klettersteig Schwierigkeit", "Via ferrata grading", "Difficoltà via ferrata", "Difficulté via ferrata"],
  iceClimbingGrade: ["Eisklettern Schwierigkeit", "Ice climbing grading", "Difficoltà cascate di ghiaccio", "Difficulté cascade de glace"],
  // "Schneeshuhtouren" and "rachette" are the spellings used by Hikr itself.
  snowshoeGrade: ["Schneeshuhtouren Schwierigkeit", "Schneeschuhtouren Schwierigkeit", "Snowshoe grading", "Difficoltà rachette", "Difficoltà racchette", "Difficulté raquettes"]
};

function normalizeLabel(text: string): string {
  // Italian listing titles contain double-encoded entities: DOM title still
  // reads "Difficolt&agrave; sci", unlike the decoded label in the tour table.
  const accents: Record<string, string> = { agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù", nbsp: " " };
  return text.replace(/&amp;/gi, "&")
    .replace(/&(agrave|egrave|eacute|igrave|ograve|ugrave|nbsp);/gi, (_, name: string) => accents[name.toLowerCase()])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-‐‑–—:：\s]+/g, "");
}

const fieldsByLabel = new Map(DIFFICULTY_FIELDS.flatMap((field) => LABELS[field].map((label) => [normalizeLabel(label), field] as const)));

export function difficultyFieldForLabel(label: string): DifficultyField | undefined {
  return fieldsByLabel.get(normalizeLabel(label));
}

const SAC_GRADES = ["L", "WS", "ZS", "S", "SS", "AS", "EX"];
const SAC_ALIASES: Record<string, string> = { F: "L", PD: "WS", AD: "ZS", D: "S", TD: "SS", MD: "SS", ED: "AS" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
// Native option values from Hikr's search form. These are ordered within each
// discipline, not comparable between sports. 6a does not mean UIAA VI.
const FRENCH_CLIMB: Record<string, number> = {
  "3": 305, "4": 405, "4+": 450, "5a": 505, "5b": 535, "5c": 575,
  "6a": 605, "6a+": 675, "6b": 685, "6b+": 715, "6c": 735, "6c+": 775,
  "7a": 805, "7a+": 835, "7b": 865, "7b+": 895, "7c": 905, "7c+": 935,
  "8a": 965, "8a+": 985, "8b": 1005, "8b+": 1050, "8c": 1065, "8c+": 1085
};

function gradeToken(value: string): string {
  return value.trim().replace(/[−–]/g, "-")
    .split(/\s+[-—]\s+|\s*\(/, 1)[0].replace(/\s+/g, "");
}

export function normalizeDifficultyGrade(field: DifficultyField, value?: string): string | undefined {
  if (!value) return undefined;
  const token = gradeToken(value);
  if (field === "hikingGrade") return /^T[1-6][+-]?$/i.test(token) ? token.toUpperCase() : undefined;
  if (field === "snowshoeGrade") return /^WT[1-6]$/i.test(token) ? token.toUpperCase() : undefined;
  if (field === "iceClimbingGrade") return /^WI[1-7]$/i.test(token) ? token.toUpperCase() : undefined;
  if (field === "viaFerrataGrade" && /^K[1-6][+-]?$/i.test(token)) return token.toUpperCase();
  if (field === "climbingGrade") {
    if (Object.hasOwn(FRENCH_CLIMB, token.toLowerCase())) return token.toLowerCase();
    const match = token.toUpperCase().match(/^([IVX]+)([+-]?)$/);
    return match && ROMAN.includes(match[1]) ? match[0] : undefined;
  }
  const match = token.toUpperCase().match(/^([A-Z]+)([+-]?)$/);
  if (!match) return undefined;
  const base = SAC_ALIASES[match[1]] ?? match[1];
  const index = SAC_GRADES.indexOf(base);
  if (index < 0 || (field === "mountainbikeGrade" && (index > 4 || match[2]))) return undefined;
  if (field === "viaFerrataGrade") return index < 6 ? `K${index + 1}${match[2]}` : undefined;
  return base + match[2];
}

export function difficultyRank(field: DifficultyField, value?: string): number {
  const grade = normalizeDifficultyGrade(field, value);
  if (!grade) return Number.NaN;
  const option = DIFFICULTY_SCALES[field].find((step) => step.label === grade);
  if (option) return option.value;
  // Preserve support for lower UIAA/T-grade +/- variants found in older reports,
  // even though the current Hikr form only offers modifiers above certain grades.
  const base = grade.replace(/[+-]$/, "");
  const modifier = grade.endsWith("+") ? 30 : grade.endsWith("-") ? -30 : 0;
  if (field === "hikingGrade") return Number(base.slice(1)) * 100 + modifier;
  if (field === "climbingGrade") return (ROMAN.indexOf(base) + 1) * 100 + modifier;
  return Number.NaN;
}

export interface DifficultyStep { label: string; value: number }

function indexedSteps(grades: string[], multiplier = 1): DifficultyStep[] {
  return grades.map((label, index) => ({ label, value: (index + 1) * multiplier }));
}

export const HIKE_FILTER_STEPS: DifficultyStep[] = [
  ...indexedSteps(["T1", "T2", "T3"], 100), { label: "T3+", value: 330 },
  ...[4, 5, 6].flatMap((grade) => [
    { label: `T${grade}-`, value: grade * 100 - 30 },
    { label: `T${grade}`, value: grade * 100 },
    { label: `T${grade}+`, value: grade * 100 + 30 }
  ])
];
export const SAC_FILTER_STEPS = indexedSteps(["L", "WS-", "WS", "WS+", "ZS-", "ZS", "ZS+", "S-", "S", "S+", "SS-", "SS", "SS+", "AS", "EX"]);
export const MOUNTAINBIKE_FILTER_STEPS = indexedSteps(SAC_GRADES.slice(0, 5), 100);
export const VIA_FERRATA_FILTER_STEPS = indexedSteps(["K1", ...[2, 3, 4, 5, 6].flatMap((grade) => [`K${grade}-`, `K${grade}`, `K${grade}+`])]);
export const ICE_CLIMBING_FILTER_STEPS = indexedSteps(["WI1", "WI2", "WI3", "WI4", "WI5", "WI6", "WI7"], 100);
export const SNOWSHOE_FILTER_STEPS = indexedSteps(["WT1", "WT2", "WT3", "WT4", "WT5", "WT6"]);
export const CLIMB_FILTER_STEPS: DifficultyStep[] = [
  ...ROMAN.slice(0, 11).flatMap((label, index) => index < 4 ? [{ label, value: (index + 1) * 100 }] : [
    { label: `${label}-`, value: (index + 1) * 100 - 30 },
    { label, value: (index + 1) * 100 },
    { label: `${label}+`, value: (index + 1) * 100 + 30 }
  ]),
  ...Object.entries(FRENCH_CLIMB).map(([label, value]) => ({ label, value }))
].sort((a, b) => a.value - b.value);

export const DIFFICULTY_SCALES: Record<DifficultyField, DifficultyStep[]> = {
  hikingGrade: HIKE_FILTER_STEPS, mountaineeringGrade: SAC_FILTER_STEPS,
  climbingGrade: CLIMB_FILTER_STEPS, skiGrade: SAC_FILTER_STEPS,
  mountainbikeGrade: MOUNTAINBIKE_FILTER_STEPS, viaFerrataGrade: VIA_FERRATA_FILTER_STEPS,
  iceClimbingGrade: ICE_CLIMBING_FILTER_STEPS, snowshoeGrade: SNOWSHOE_FILTER_STEPS
};

export function parseTourDifficulties(documentRef: Document): TourDifficulties {
  const result: TourDifficulties = {};
  const scope = documentRef.querySelector("table.fiche_rando") ?? documentRef;
  for (const row of scope.querySelectorAll("tr")) {
    // Direct cells avoid accidentally interpreting an outer layout table as data.
    const cells = [...row.children].filter((cell) => cell.matches("td, th"));
    if (cells.length < 2) continue;
    const field = difficultyFieldForLabel(cells[0].textContent ?? "");
    if (!field) continue;
    const value = cells[1].cloneNode(true) as Element;
    value.querySelectorAll("script, style").forEach((el) => el.remove());
    const grade = normalizeDifficultyGrade(field, value.textContent ?? "");
    if (grade) result[field] = grade;
  }
  return result;
}

export function parseListingDifficulties(card: HTMLElement): TourDifficulties {
  const result: TourDifficulties = {};
  for (const badge of card.querySelectorAll<HTMLElement>("span[title], span[style]")) {
    if (badge.closest(".hikr-ext-tour-details")) continue;
    const title = badge.getAttribute("title") ?? "";
    let field = difficultyFieldForLabel(title);
    // Legacy badges without titles are safe only for unambiguous T/UIAA grades.
    if (!field && !title && badge.style.width === "30px") {
      const text = badge.textContent?.trim() ?? "";
      if (/^T[1-6][+-]?$/i.test(text)) field = "hikingGrade";
      else if (/^[IVX]+[+-]?$/i.test(text)) field = "climbingGrade";
    }
    if (!field) continue;
    const grade = normalizeDifficultyGrade(field, badge.textContent ?? "");
    if (grade) result[field] = grade;
  }
  return result;
}
