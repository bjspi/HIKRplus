import { sendMessage } from "../../shared/messages";
import type { HikrFeature } from "../feature-types";
import { enrichVisibleTours } from "./tour-details";

export const excelExportFeature: HikrFeature = {
  id: "excelExport",
  title: "Excel Export",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0,
  run(context) {
    document.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-hikr-action="excel"]');
      if (!button) return;
      void (async () => {
        try {
          context.log("Excel wird erstellt...");
          const { tours, waypoints } = await enrichVisibleTours(context.page.tourUrls, false, {
            waypointGmapsLinks: context.settings.ui.waypointGmapsLinks
          });
          const response = await sendMessage({ type: "EXPORT_EXCEL", request: { tours, waypoints, filename: "HIKR_TOUREN.xlsx" } });
          if ("ok" in response && !response.ok) {
            context.log(`Excel Fehler: ${(response as { ok: false; error: string }).error}`);
          } else {
            context.log(`Excel exportiert (${tours.length} Touren) → Downloads-Ordner`);
          }
        } catch (error) {
          context.log(`Excel Fehler: ${String(error)}`);
        }
      })();
    });
  }
};
