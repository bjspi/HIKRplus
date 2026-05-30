import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { toursToExcel } from "../shared/excel";
import { TOUR_CACHE_VERSION } from "../shared/types";

describe("excel export", () => {
  it("exports tour and waypoint data as a real .xlsx workbook", () => {
    const bytes = toursToExcel({
      tours: [
        {
          id: "1",
          url: "https://www.hikr.org/tour/post1.html",
          title: "Tour",
          dateOfHike: "2024-07-18",
          hikingGrade: "T4",
          tourDuration: "5:00",
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

    // Real .xlsx files are ZIP archives — they start with the "PK" signature.
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K

    // Parse it back and verify the actual cell content.
    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toContain("HIKR Touren");
    const sheet = wb.Sheets["HIKR Touren"];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });

    const headers = rows[0];
    expect(headers).toContain("Titel");
    expect(headers).toContain("Latitude");
    expect(headers).toContain("Longitude");

    const dataRow = rows[1];
    expect(dataRow).toContain("Tour");
    expect(dataRow).toContain("2024-07-18");
    expect(dataRow.join(",")).toContain("47.1");
    expect(dataRow.join(",")).toContain("10.2");
    expect(dataRow).toContain("Start");
  });
});
