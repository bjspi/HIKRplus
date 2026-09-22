import { describe, expect, it } from "vitest";
import { DIFFICULTY_SCALES, difficultyFieldForLabel, difficultyRank, normalizeDifficultyGrade, parseListingDifficulties, type DifficultyField } from "../shared/difficulty";
import { parseHtml, parseTourDocument } from "../shared/parser";
import hikrScales from "./fixtures/hikr-difficulty-scales.json";

const activityFields = {
  ped: "hikingGrade", alp: "mountaineeringGrade", esc: "climbingGrade", ski: "skiGrade",
  mtb: "mountainbikeGrade", via: "viaFerrataGrade", eis: "iceClimbingGrade", raq: "snowshoeGrade"
} as const satisfies Record<string, DifficultyField>;

describe("Hikr search option indices (captured 2026-09-22)", () => {
  for (const [locale, scales] of Object.entries(hikrScales)) {
    for (const [activity, field] of Object.entries(activityFields)) {
      it(`matches every ${locale}/${activity} option to its exact native numeric value`, () => {
        const options = scales[activity as keyof typeof scales];
        expect(DIFFICULTY_SCALES[field]).toHaveLength(options.length);
        for (const [label, index] of options) {
          expect(difficultyRank(field, String(label)), String(label)).toBe(index);
        }
        expect(DIFFICULTY_SCALES[field].map((step) => step.value))
          .toEqual(options.map(([, value]) => Number(value)).sort((a, b) => a - b));
      });
    }
  }
});

describe.each([
  ["Klettersteig Schwierigkeit", "K2 (WS)", "viaFerrataGrade", "K2", 3],
  ["Via ferrata grading", "K2 (PD)", "viaFerrataGrade", "K2", 3],
  ["Difficoltà via ferrata", "MD+ (K5+)", "viaFerrataGrade", "K5+", 13],
  ["Difficulté via ferrata", "ED- (K6-)", "viaFerrataGrade", "K6-", 14],
  ["Eisklettern Schwierigkeit", "WI2", "iceClimbingGrade", "WI2", 200],
  ["Ice climbing grading", "WI2", "iceClimbingGrade", "WI2", 200],
  ["Difficoltà cascate di ghiaccio", "WI2", "iceClimbingGrade", "WI2", 200],
  ["Difficulté cascade de glace", "WI2", "iceClimbingGrade", "WI2", 200],
  ["Schneeshuhtouren Schwierigkeit", "WT2 - Schneeschuhwanderung", "snowshoeGrade", "WT2", 2],
  ["Snowshoe grading", "WT2 - Snowshoe hike", "snowshoeGrade", "WT2", 2],
  ["Difficoltà rachette", "WT2 - Escursione con racchette", "snowshoeGrade", "WT2", 2],
  ["Difficulté raquettes", "WT2 - Randonnée en raquettes", "snowshoeGrade", "WT2", 2]
] as const)("%s", (label, value, field, grade, index) => {
  it("recognizes the discipline in both a tour table and a listing title", () => {
    const url = "https://www.hikr.org/tour/post1.html";
    const doc = parseHtml(`<table class="fiche_rando"><tr><td>${label}:</td><td>${value}</td></tr></table>`, url);
    expect(parseTourDocument(doc, url)[field]).toBe(grade);
    const card = document.createElement("div");
    card.innerHTML = `<span title="${label.replace(/à/g, "&amp;agrave;")}">${value}</span>`;
    expect(parseListingDifficulties(card)).toEqual({ [field]: grade });
    expect(difficultyRank(field, value)).toBe(index);
  });
});

// Labels/values captured from post178147, post200469, post202628 and the ski
// search at 47.052144,8.3058123 via Chrome DevTools in all four site languages.
const locales = [
  { lang: "de", labels: ["Wandern Schwierigkeit", "Hochtouren Schwierigkeit", "Klettern Schwierigkeit", "Ski Schwierigkeit", "Mountainbike Schwierigkeit"], alpine: "WS+", ski: "ZS", mtb: "WS - Gut fahrbar", scale: "UIAA-Skala" },
  { lang: "en", labels: ["Hiking grading", "Mountaineering grading", "Climbing grading", "Ski grading", "Mountain-bike grading"], alpine: "PD+", ski: "AD", mtb: "PD - Moderate", scale: "UIAA Grading System" },
  { lang: "it", labels: ["Difficoltà escursionismo", "Difficoltà alta montagna", "Difficoltà arrampicata", "Difficoltà sci", "Difficoltà Mountain-bike"], alpine: "PD+", ski: "AD", mtb: "PD - medio", scale: "Scala UIAA" },
  { lang: "fr", labels: ["Difficulté randonnée", "Difficulté haute montagne", "Difficulté escalade", "Difficulté ski", "Difficulté VTT"], alpine: "PD+", ski: "AD", mtb: "PD - Peu difficile", scale: "Cotations UIAA" }
];

describe.each(locales)("$lang difficulties", ({ labels, alpine, ski, mtb, scale }) => {
  const values = ["T5 - description", alpine, `II<span> (${scale})</span>`, ski, mtb];
  const expected = { hikingGrade: "T5", mountaineeringGrade: "WS+", climbingGrade: "II", skiGrade: "ZS", mountainbikeGrade: "WS" };

  it("keeps all disciplines separate and normalizes translated tour values", () => {
    const doc = parseHtml(`<table><tr><td>Layout</td><td><table class="fiche_rando">${labels.map((label, i) =>
      `<tr><th> ${label} :</th><td><a>${values[i]}</a></td></tr>`).join("")}</table></td></tr></table>`, "https://www.hikr.org/tour/post1.html");
    expect(parseTourDocument(doc, "https://www.hikr.org/tour/post1.html")).toMatchObject(expected);
  });

  it("uses the same labels for listing badges, including encoded Italian titles", () => {
    const card = document.createElement("div");
    card.innerHTML = labels.map((label, i) => `<span title="${label.replace(/à/g, "&amp;agrave;")}" style="width:30px">${values[i]}</span>`).join("");
    expect(parseListingDifficulties(card)).toEqual(expected);
  });
});

describe("difficulty classification", () => {
  it("handles punctuation, whitespace, accents and numeric entities in labels", () => {
    expect(difficultyFieldForLabel("  DIFFICOLT&Agrave;\n sci : ")).toBe("skiGrade");
    expect(difficultyFieldForLabel("Difficolt&#224; alta montagna")).toBe("mountaineeringGrade");
    expect(difficultyFieldForLabel("Difficolt&#xE0; Mountain-bike")).toBe("mountainbikeGrade");
    expect(difficultyFieldForLabel("Difficulté randonnée :")).toBe("hikingGrade");
    expect(difficultyFieldForLabel("Ski difficulty notes")).toBeUndefined();
  });

  it("never assigns ambiguous unlabelled grades to alpine, ski or MTB", () => {
    const card = document.createElement("div");
    card.innerHTML = `<span style="width:30px">S</span><span style="width:30px">PD</span>
      <span title="Ski Schwierigkeit" style="width:30px">S</span>
      <span title="Mountainbike Schwierigkeit" style="width:30px">WS</span>
      <span title="Unrelated" style="width:30px">II</span>`;
    expect(parseListingDifficulties(card)).toEqual({ skiGrade: "S", mountainbikeGrade: "WS" });
  });

  it("uses only the tour table, retaining grade text wrapped in spans", () => {
    const doc = parseHtml(`<table><tr><td>Ski Schwierigkeit:</td><td>EX</td></tr></table>
      <table class="fiche_rando"><tr><td>Klettern Schwierigkeit:</td><td><span>II</span><span> (UIAA-Skala)</span></td></tr></table>`, "https://www.hikr.org/tour/post1.html");
    const tour = parseTourDocument(doc, "https://www.hikr.org/tour/post1.html");
    expect(tour.climbingGrade).toBe("II");
    expect(tour.skiGrade).toBeUndefined();
    expect(tour.mountaineeringGrade).toBeUndefined();
  });

  it.each(["mountaineeringGrade", "skiGrade", "mountainbikeGrade"] as const)("orders equivalent languages consistently for %s", (field) => {
    for (const [de, other] of [["L", "F"], ["WS", "PD"], ["ZS", "AD"], ["S", "D"], ["SS", "TD"]]) {
      expect(difficultyRank(field, de)).toBe(difficultyRank(field, other));
    }
    expect(difficultyRank(field, "L")).toBeLessThan(difficultyRank(field, "WS"));
    expect(difficultyRank(field, "WS")).toBeLessThan(difficultyRank(field, "ZS"));
  });

  it("preserves modifiers and rejects invalid or different scales", () => {
    expect(difficultyRank("skiGrade", "PD−")).toBe(2);
    expect(difficultyRank("mountaineeringGrade", "WS+")).toBe(4);
    expect(difficultyRank("mountaineeringGrade", "ED")).toBe(14);
    expect(difficultyRank("skiGrade", "EX")).toBe(15);
    expect(difficultyRank("viaFerrataGrade", "EX")).toBeNaN();
    expect(difficultyRank("iceClimbingGrade", "WT2")).toBeNaN();
    expect(difficultyRank("snowshoeGrade", "WI2")).toBeNaN();
    expect(difficultyRank("viaFerrataGrade", "K7")).toBeNaN();
    expect(difficultyRank("skiGrade", "T5")).toBeNaN();
    expect(difficultyRank("mountainbikeGrade", "EX")).toBeNaN();
    expect(difficultyRank("skiGrade", undefined)).toBeNaN();
    expect(difficultyRank("skiGrade", "Unknown")).toBeNaN();
    expect(normalizeDifficultyGrade("hikingGrade", "T5 - demanding hike")).toBe("T5");
  });

  it("supports UIAA and French climbing grades using Hikr's ordering", () => {
    expect(difficultyRank("climbingGrade", "IX+")).toBe(930);
    expect(difficultyRank("climbingGrade", "6a (Französische Skala)")).toBe(605);
    expect(difficultyRank("climbingGrade", "VI")).toBeLessThan(difficultyRank("climbingGrade", "6a"));
    expect(difficultyRank("climbingGrade", "6a")).toBeLessThan(difficultyRank("climbingGrade", "VI+"));
    expect(difficultyRank("climbingGrade", "6c+")).toBeLessThan(difficultyRank("climbingGrade", "7a"));
  });
});
