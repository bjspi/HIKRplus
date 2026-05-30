import { describe, expect, it } from "vitest";
import { toursToExcel } from "../shared/excel";
import { TOUR_CACHE_VERSION } from "../shared/types";

describe("excel export", () => {
  it("exports tour and waypoint data as SpreadsheetML XML", () => {
    const xml = toursToExcel({
      tours: [
        {
          id: "1",
          url: "https://www.hikr.org/tour/post1.html",
          title: "Tour",
          waypointUrls: ["https://www.hikr.org/dir/Start_1"],
          waypoints: [],
          geodataLinks: [],
          startWaypointUrl: "https://www.hikr.org/dir/Start_1",
          cacheVersion: TOUR_CACHE_VERSION,
          parsedAt: 1,
          missingFields: []
        }
      ],
      waypoints: [
        {
          id: "Start_1",
          url: "https://www.hikr.org/dir/Start_1",
          name: "Start",
          coordinates: { lat: 47.1, lng: 10.2 },
          parsedAt: 1,
          missingFields: []
        }
      ]
    });
    expect(xml).toContain("Tour");
    expect(xml).toContain("47.1");
    expect(xml).toContain("10.2");
    expect(xml).toContain("Excel.Sheet");
  });
});
