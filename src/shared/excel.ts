import * as XLSX from "xlsx";
import type { ExcelExportRequest, RouteCacheRecord, TourCacheRecord, WaypointCacheRecord } from "./types";

function findWaypoint(tour: TourCacheRecord, waypoints: WaypointCacheRecord[]): WaypointCacheRecord | undefined {
  return waypoints.find((wp) => wp.url === tour.startWaypointUrl);
}

function findRoute(tour: TourCacheRecord, routes: RouteCacheRecord[] = []): RouteCacheRecord | undefined {
  return routes.find((r) => tour.startWaypointUrl && r.id.includes(tour.id));
}

export function toursToExcel(request: ExcelExportRequest): Uint8Array {
  const headers = [
    "Titel", "Tour-Link", "Tour Datum", "Wandern", "Klettern",
    "Dauer", "Höhenmeter", "Höchster Punkt (m)", "Strecke", "Start-Wegpunkt",
    "Latitude", "Longitude", "Fahrtstrecke", "Fahrtdauer"
  ];

  const dataRows = request.tours.map((tour) => {
    const wp = findWaypoint(tour, request.waypoints);
    const rt = findRoute(tour, request.routes);
    return [
      tour.title ?? "", tour.url ?? "", tour.dateOfHike ?? "",
      tour.hikingGrade ?? "", tour.climbingGrade ?? "",
      tour.tourDuration ?? "", tour.heightGain ?? "", tour.maxElevation ?? "", tour.routeLength ?? "",
      wp?.name ?? tour.startWaypointName ?? "",
      wp?.coordinates?.lat ?? "", wp?.coordinates?.lng ?? "",
      rt?.distanceText ?? "", rt?.durationText ?? ""
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Column widths
  ws["!cols"] = [
    { wch: 42 }, // Titel
    { wch: 38 }, // Tour-Link
    { wch: 12 }, // Datum
    { wch: 10 }, // Wandern
    { wch: 10 }, // Klettern
    { wch: 10 }, // Dauer
    { wch: 12 }, // Höhenmeter
    { wch: 18 }, // Höchster Punkt
    { wch: 10 }, // Strecke
    { wch: 24 }, // Start-Wegpunkt
    { wch: 11 }, // Lat
    { wch: 11 }, // Lng
    { wch: 14 }, // Fahrtstrecke
    { wch: 12 }, // Fahrtdauer
  ];

  // Bold + background on header row
  for (let col = 0; col < headers.length; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "EEE8E4" }, patternType: "solid" }
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "HIKR Touren");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  return new Uint8Array(buffer);
}
