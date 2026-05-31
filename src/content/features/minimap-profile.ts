import type { HikrFeature } from "../feature-types";

function injectFileScript(src: string, data?: Record<string, string>): void {
  if (document.querySelector(`script[data-hikr-ext-src="${src}"]`)) return;
  const script = document.createElement("script");
  script.dataset.hikrExtSrc = src;
  if (data) {
    for (const [key, value] of Object.entries(data)) script.dataset[key] = value;
  }
  script.src = src;
  script.async = false;
  document.documentElement.append(script);
}

export const miniMapProfileFeature: HikrFeature = {
  id: "miniMapProfileLoader",
  title: "MiniMap/Profile Loader",
  defaultEnabled: true,
  matchesPage: (context) => context.isTopFrame,
  run({ settings }) {
    if (!settings.ui.alwaysOpenMiniMaps) return;
    // Pass the optional Mapy.com tile key into the page-context bridge so it can
    // offer a Mapy base layer alongside the injected OpenTopoMap / OSM layers.
    injectFileScript(chrome.runtime.getURL("inject/minimap-bridge.js"), {
      mapyKey: settings.provider.apiKeys.mapy ?? ""
    });
  }
};
