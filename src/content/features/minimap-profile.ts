import type { HikrFeature } from "../feature-types";

function injectFileScript(src: string): void {
  if (document.querySelector(`script[data-hikr-ext-src="${src}"]`)) return;
  const script = document.createElement("script");
  script.dataset.hikrExtSrc = src;
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
    injectFileScript(chrome.runtime.getURL("inject/minimap-bridge.js"));
  }
};
