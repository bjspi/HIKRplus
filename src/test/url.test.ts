import { describe, expect, it } from "vitest";
import { getTourId, getWaypointId, normalizeHikrUrl } from "../shared/url";

describe("url helpers", () => {
  it("normalizes URLs and removes query/hash/trailing slash", () => {
    expect(normalizeHikrUrl("https://www.hikr.org/dir/Test_123/?x=1#top")).toBe("https://www.hikr.org/dir/Test_123");
  });

  it("extracts tour and waypoint ids", () => {
    expect(getTourId("https://www.hikr.org/tour/post12345.html")).toBe("12345");
    expect(getWaypointId("https://www.hikr.org/dir/Test_123/")).toBe("Test_123");
  });
});
