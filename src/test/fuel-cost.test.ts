import { describe, expect, it } from "vitest";
import {
  computeFuelCost,
  formatEur,
  fuelCostText,
  isFuelConfigValid,
  parseFuelInput
} from "../shared/fuel-cost";

describe("fuel cost helpers", () => {
  it("parses decimal comma and dot inputs", () => {
    expect(parseFuelInput("5,5")).toBe(5.5);
    expect(parseFuelInput("1.85")).toBe(1.85);
    expect(parseFuelInput("")).toBeNaN();
    expect(parseFuelInput("abc")).toBeNaN();
  });

  it("validates fuel config values", () => {
    expect(isFuelConfigValid({ pricePerLitre: 0, consumptionLPer100km: 0 })).toBe(false);
    expect(isFuelConfigValid({ pricePerLitre: -1, consumptionLPer100km: 7.5 })).toBe(false);
    expect(isFuelConfigValid({ pricePerLitre: Number.NaN, consumptionLPer100km: 7.5 })).toBe(false);
    expect(isFuelConfigValid({ pricePerLitre: 1.85, consumptionLPer100km: 7.5 })).toBe(true);
  });

  it("computes one-way and round-trip cost", () => {
    expect(computeFuelCost(100000, { pricePerLitre: 1.8, consumptionLPer100km: 8 })).toEqual({
      oneway: 14.4,
      twoway: 28.8
    });
  });

  it("formats euro values in de-DE", () => {
    expect(formatEur(14.4)).toMatch(/^14,4(?:\s|\u00A0|\u202F)€$/);
  });

  it("builds the combined fuel cost text", () => {
    const text = fuelCostText(100000, { pricePerLitre: 1.8, consumptionLPer100km: 8 });
    expect(text).toContain("14,4");
    expect(text).toContain("28,8");
    expect(text).toContain("⇄");
    expect(fuelCostText(100000, { pricePerLitre: 0, consumptionLPer100km: 8 })).toBeNull();
  });
});
