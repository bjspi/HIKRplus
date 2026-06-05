import { describe, expect, it } from "vitest";
import {
  SORT_CRITERIA,
  buildSortGridHtml,
  compareValues,
  isDriveKey,
  parseClimbGrade,
  parseDurationMinutes,
  parseHikeGrade,
  parseIsoDate,
  parseKm,
  parseMeters
} from "../shared/sort";

describe("sort value parsing", () => {
  it("parses ascent/descent metres", () => {
    expect(parseMeters("473 m")).toBe(473);
    expect(parseMeters("2981 m")).toBe(2981);
    expect(parseMeters(undefined)).toBeNaN();
  });

  it("parses route length in km (German comma, no-space, free text)", () => {
    expect(parseKm("10,7 km")).toBeCloseTo(10.7);
    expect(parseKm("47km")).toBe(47);
    expect(parseKm("7 km mit recht hohem Weglos-Anteil")).toBe(7);
    expect(parseKm("s. Karte - (leider fkt die Eingabe…)")).toBeNaN();
    expect(parseKm("Gausbach - Felsengelände")).toBeNaN();
  });

  it("parses duration into minutes (h:mm and days)", () => {
    expect(parseDurationMinutes("4:45")).toBe(285);
    expect(parseDurationMinutes("5:00")).toBe(300);
    expect(parseDurationMinutes("2 Tage")).toBe(2880);
    expect(parseDurationMinutes("1 Tag")).toBe(1440);
    expect(parseDurationMinutes("keine Angabe")).toBeNaN();
  });

  it("orders hiking grades with +/- modifiers", () => {
    expect(parseHikeGrade("T5")).toBe(5);
    expect(parseHikeGrade("T3+")).toBeCloseTo(3.3);
    expect(parseHikeGrade("T4-")).toBeCloseTo(3.7);
    expect(parseHikeGrade("T5+")).toBeCloseTo(5.3);
    expect(parseHikeGrade("T5-")).toBeCloseTo(4.7);
    expect(parseHikeGrade("T6")).toBe(6);
    expect(parseHikeGrade("T6-") < parseHikeGrade("T6")).toBe(true);
    expect(parseHikeGrade("T6") < parseHikeGrade("T6+")).toBe(true);
    expect(parseHikeGrade("foo")).toBeNaN();
  });

  it("orders climbing grades (roman, +/-)", () => {
    expect(parseClimbGrade("I")).toBe(1);
    expect(parseClimbGrade("II")).toBe(2);
    expect(parseClimbGrade("VI")).toBe(6);
    expect(parseClimbGrade("VIII")).toBe(8);
    expect(parseClimbGrade("VI-")).toBeCloseTo(5.7);
    expect(parseClimbGrade("II+")).toBeCloseTo(2.3);
    expect(parseClimbGrade("I") < parseClimbGrade("II")).toBe(true);
    expect(parseClimbGrade("L")).toBeNaN(); // mountainbike badge, not a climbing grade
    expect(parseClimbGrade("K5")).toBeNaN(); // via ferrata badge, not a climbing grade
    expect(parseClimbGrade("WS-")).toBeNaN(); // alpine tour badge, not a climbing grade
  });

  it("normalises ISO hike dates to a sortable number", () => {
    expect(parseIsoDate("2024-07-18")).toBe(20240718);
    expect(parseIsoDate("2016-05-21")).toBe(20160521);
    expect(parseIsoDate(undefined)).toBeNaN();
  });

  it("pushes missing values to the end in both directions", () => {
    const arr = [3, Number.NaN, 1, 2];
    expect([...arr].sort((a, b) => compareValues(a, b, "asc"))).toEqual([1, 2, 3, Number.NaN]);
    expect([...arr].sort((a, b) => compareValues(a, b, "desc"))).toEqual([3, 2, 1, Number.NaN]);
  });
});

describe("sort grid markup", () => {
  it("hides drive criteria until route data exists", () => {
    expect(isDriveKey("hikrDriveDuration")).toBe(true);
    expect(isDriveKey("hikrAscent")).toBe(false);

    const withoutDrive = buildSortGridHtml("hikrDate", "desc", false);
    expect(withoutDrive).not.toContain("hikrDriveDuration");
    expect(withoutDrive).toContain("hikrDate");

    const withDrive = buildSortGridHtml("hikrDate", "desc", true);
    expect(withDrive).toContain("hikrDriveDuration");
    expect(withDrive).toContain("hikrDriveDistance");
  });

  it("marks the active criterion with a direction arrow", () => {
    const html = buildSortGridHtml("hikrAscent", "asc", true);
    expect(html).toContain("hikr-ext-sort-active");
    expect(html).toContain("▲");
    expect(buildSortGridHtml("hikrAscent", "desc", true)).toContain("▼");
  });

  it("covers all criteria when drive data is present", () => {
    const html = buildSortGridHtml("hikrDate", "asc", true);
    for (const c of SORT_CRITERIA) expect(html).toContain(`data-sort-key="${c.key}"`);
  });
});
