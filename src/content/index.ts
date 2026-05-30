import { detectPageContext } from "../shared/url";
import { sendMessage } from "../shared/messages";
import { devLog, setDevLogging } from "../shared/dev-log";
import { detectLocaleFromBrowser, setLocale } from "../shared/i18n";
import type { ExtensionSettings } from "../shared/types";
import { CONTENT_CSS } from "../styles/content-css";
import { ensureRoot, injectStyle } from "./dom";
import { features } from "./features/registry";

function isContextInvalidated(error: unknown): boolean {
  return String((error as { message?: unknown } | undefined)?.message ?? error).includes("Extension context invalidated");
}

function showReloadNotice(): void {
  if (document.querySelector(".hikr-ext-reload-notice")) return;
  const notice = document.createElement("div");
  notice.className = "hikr-ext-reload-notice";
  notice.style.cssText = [
    "position:fixed", "bottom:20px", "left:50%", "transform:translateX(-50%)",
    "background:#2a2422", "color:#fff", "padding:10px 18px", "border-radius:8px",
    "font:13px/1.4 Inter,ui-sans-serif,system-ui,sans-serif", "z-index:2147483647",
    "box-shadow:0 4px 20px rgba(0,0,0,.35)", "display:flex", "gap:12px", "align-items:center",
    "white-space:nowrap"
  ].join(";");
  notice.innerHTML = `<span>HIKR Enhancements neu geladen.</span><a href="" style="color:#c97a74;text-decoration:underline;cursor:pointer">Seite neu laden</a>`;
  notice.querySelector("a")?.addEventListener("click", (e) => { e.preventDefault(); location.reload(); });
  document.body.appendChild(notice);
}

window.addEventListener("unhandledrejection", (event) => {
  if (isContextInvalidated(event.reason)) {
    event.preventDefault();
    showReloadNotice();
  }
});

function userscriptValues(): Record<string, string | null> {
  return {
    start_co: localStorage.getItem("start_co"),
    load_pages: localStorage.getItem("load_pages"),
    ors_apikey: localStorage.getItem("ors_apikey"),
    gm_apikey: localStorage.getItem("gm_apikey"),
    formData: localStorage.getItem("formData")
  };
}

async function migrateUserscriptSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  if (settings.migration.userscriptMigratedAt) return settings;
  const hasLegacyValue = Object.values(userscriptValues()).some(Boolean);
  if (!hasLegacyValue) return settings;
  const response = await sendMessage<{ migrated: boolean; settings: ExtensionSettings }>({
    type: "MIGRATE_USERSCRIPT_SETTINGS",
    values: userscriptValues()
  });
  return response.settings;
}

function setStatus(root: HTMLElement, message: string): void {
  const status = root.querySelector<HTMLElement>(".hikr-ext-status");
  if (status) status.textContent = message;
}

async function boot(): Promise<void> {
  if (location.hostname !== "www.hikr.org") return;
  if (location.href.includes(".hikr.org/gallery/photo") || location.href.includes("hikr.org/edit_rando.php")) return;
  const page = detectPageContext(document, location.href);
  let { settings } = await sendMessage<{ settings: ExtensionSettings }>({ type: "GET_SETTINGS" });
  settings = await migrateUserscriptSettings(settings);
  setLocale(settings.language ?? detectLocaleFromBrowser());
  setDevLogging(Boolean(settings.dev?.consoleLogging));
  devLog("boot", "page", page.pageType, { tours: page.tourUrls.length, waypoints: page.waypointUrls.length, url: location.href });
  localStorage.setItem("hikr-ext-wide-layout", String(settings.ui.wideLayout));
  injectStyle(CONTENT_CSS);
  const root = ensureRoot();
  document.documentElement.classList.toggle("hikr-ext-wide-layout", settings.ui.wideLayout);
  document.body.classList.toggle("hikr-ext-wide-layout", settings.ui.wideLayout);
  const context = {
    page,
    settings,
    root,
    log(message: string) {
      setStatus(root, message);
    }
  };
  for (const feature of features) {
    if (!settings.features[feature.id]) continue;
    if (!feature.matchesPage(page)) continue;
    try {
      await feature.run(context);
    } catch (error) {
      console.error(`HIKR feature failed: ${feature.id}`, error);
      context.log(`${feature.title}: Fehler`);
    }
  }
  if (page.pageType === "searchResults" && page.tourUrls.length > 0 && settings.sort.auto) {
    void import("./features/sort-results").then(({ runAutoSort }) => runAutoSort(context));
  }
  document.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-hikr-action]");
    if (!button) return;
    const action = button.dataset.hikrAction;
    if (action === "enrich") {
      void import("./features/tour-details").then(({ enrichVisibleTours }) =>
        enrichVisibleTours(page.tourUrls, true, { waypointGmapsLinks: settings.ui.waypointGmapsLinks })
      );
    }
    if (action === "options") {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" }).catch(() => undefined);
    }
    if (action === "sort") {
      void import("./features/sort-results").then(({ openSortMenu }) => openSortMenu(context));
    }
  });
  chrome.runtime.onMessage.addListener((message: { type?: string; action?: string }) => {
    if (message.type !== "HIKR_CONTENT_ACTION" || !message.action) return;
    const button = document.querySelector<HTMLButtonElement>(`[data-hikr-action="${message.action}"]`);
    button?.click();
  });
}

boot().catch((error) => {
  if (isContextInvalidated(error)) showReloadNotice();
  else console.error("HIKR boot failed", error);
});
