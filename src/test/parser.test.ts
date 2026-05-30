import { describe, expect, it } from "vitest";
import { parseHtml, parseTourDocument, parseWaypointDocument } from "../shared/parser";

describe("hikr parser", () => {
  it("parses tour fields without relying only on German labels", () => {
    const doc = parseHtml(
      `
      <h1 class="title">Sample Tour</h1>
      <table>
        <tr><td>Date of the hike:</td><td>2024-07-18</td></tr>
        <tr><td>Time:</td><td>5h</td></tr>
        <tr><td>Height gain:</td><td>1200m <span>ignore</span></td></tr>
        <tr><td>Route:</td><td>14km</td></tr>
        <tr><td>Waypoints:</td><td><ul><li><a href="/dir/Start_1/">Start</a></li></ul></td></tr>
      </table>`,
      "https://www.hikr.org/tour/post1.html"
    );
    const tour = parseTourDocument(doc, "https://www.hikr.org/tour/post1.html");
    expect(tour.title).toBe("Sample Tour");
    expect(tour.dateOfHike).toBe("2024-07-18");
    expect(tour.startWaypointUrl).toBe("https://www.hikr.org/dir/Start_1");
    expect(tour.geodataLinks).toEqual([]);
  });

  it("parses geodata links", () => {
    const doc = parseHtml(
      `<h1>Tour</h1><a href="/tour/post1.gpx">GPX</a><a href="/tour/post1.kml">KML</a>`,
      "https://www.hikr.org/tour/post1.html"
    );
    const tour = parseTourDocument(doc, "https://www.hikr.org/tour/post1.html");
    expect(tour.geodataLinks).toEqual([
      { url: "https://www.hikr.org/tour/post1.gpx", format: "gpx", label: "GPX" },
      { url: "https://www.hikr.org/tour/post1.kml", format: "kml", label: "KML" }
    ]);
  });

  it("parses waypoint coordinates", () => {
    const doc = parseHtml(
      `<h1 class="title">Start</h1><table><tr><td>Koordinaten:</td><td>47.654619,10.364131</td></tr></table>`,
      "https://www.hikr.org/dir/Start_1/"
    );
    const waypoint = parseWaypointDocument(doc, "https://www.hikr.org/dir/Start_1/");
    expect(waypoint.coordinates).toEqual({ lat: 47.654619, lng: 10.364131 });
  });
});
