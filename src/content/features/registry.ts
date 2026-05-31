import type { HikrFeature } from "../feature-types";
import { excelExportFeature } from "./excel-export";
import { exploreFormFeature } from "./explore-form";
import { galleryLightboxFeature } from "./gallery";
import { hoverPreviewFeature } from "./hover-preview";
import { miniMapProfileFeature } from "./minimap-profile";
import { waypointPizHarvestFeature } from "./waypoint-piz-harvest";
import { paginationFeature } from "./pagination";
import { panelFeature } from "./panel";
import { routesFeature } from "./routes";
import { startpointMapFeature } from "./startpoint-map";
import { tourDetailsFeature } from "./tour-details";
import { waypointGmapsLinksFeature } from "./waypoint-gmaps-links";
import { waypointListMapLinksFeature } from "./waypoint-list-map-links";
import { snowResearchFeature } from "./snow-research";

export const features: HikrFeature[] = [
  panelFeature,
  miniMapProfileFeature,
  waypointPizHarvestFeature,
  galleryLightboxFeature,
  exploreFormFeature,
  paginationFeature,
  tourDetailsFeature,
  routesFeature,
  excelExportFeature,
  hoverPreviewFeature,
  waypointListMapLinksFeature,
  startpointMapFeature,
  waypointGmapsLinksFeature,
  snowResearchFeature
];
