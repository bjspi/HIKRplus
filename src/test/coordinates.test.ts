import { describe, expect, it } from "vitest";
import { clusterCoordinates, parseCoordinates } from "../shared/coordinates";

describe("coordinates", () => {
  it("parses decimal degree coordinate pairs", () => {
    expect(parseCoordinates("47.654619,10.364131")).toEqual({ lat: 47.654619, lng: 10.364131 });
  });

  it("parses DMS coordinates", () => {
    expect(parseCoordinates('47°39\'16" N, 10°21\'50" E')).toEqual({ lat: 47.654444, lng: 10.363889 });
  });

  it("clusters nearby coordinates into stable cells", () => {
    const a = clusterCoordinates({ lat: 48.897, lng: 9.19 }, 1000);
    const b = clusterCoordinates({ lat: 48.898, lng: 9.191 }, 1000);
    expect(a).toBe(b);
  });
});
