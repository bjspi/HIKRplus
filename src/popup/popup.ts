import { sendMessage } from "../shared/messages";
import { detectLocaleFromBrowser, setLocale, t } from "../shared/i18n";
import type { ExtensionSettings } from "../shared/types";
import { UI_CSS } from "../styles/ui-css";

function css() {
  const style = document.createElement("style");
  style.textContent = UI_CSS;
  document.head.append(style);
  document.body.classList.add("popup");
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function contentAction(action: string): Promise<void> {
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, { type: "HIKR_CONTENT_ACTION", action }).catch(() => undefined);
}

async function render() {
  const tab = await activeTab();
  const { settings } = await sendMessage<{ settings: ExtensionSettings }>({ type: "GET_SETTINGS" });
  setLocale(settings.language ?? detectLocaleFromBrowser());
  const { stats } = await sendMessage<{ stats: { tours: number; waypoints: number; routes: number } }>({ type: "GET_CACHE_STATS" });
  const onHikr = Boolean(tab?.url?.startsWith("https://www.hikr.org/"));
  document.querySelector("#app")!.innerHTML = `
    <header class="hero">
      <img src="${chrome.runtime.getURL("icons/hikr-logo.png")}" alt="" />
      <div>
        <h1>${t("extension_name")}</h1>
        <p>${onHikr ? t("hikr_detected") : t("hikr_not_detected")}</p>
      </div>
    </header>
    <main class="content">
      <section class="popup-card">
        <h2>${t("status_title")}</h2>
        <p class="muted">Route: ${settings.provider.routeProvider}, Map: ${settings.provider.mapProvider}</p>
        <p class="muted">${t("cache_stats", { tours: stats.tours, waypoints: stats.waypoints, routes: stats.routes })}</p>
      </section>
      <section class="popup-card">
        <h2>${t("quick_actions")}</h2>
        <div class="popup-actions">
          <button class="btn" data-action="enrich" ${onHikr ? "" : "disabled"}>${t("btn_details")}</button>
          <button class="btn" data-action="routes" ${onHikr ? "" : "disabled"}>${t("btn_routes")}</button>
          <button class="btn" data-action="map" ${onHikr ? "" : "disabled"}>${t("btn_map")}</button>
          <button class="btn" data-action="csv" ${onHikr ? "" : "disabled"}>${t("btn_csv")}</button>
        </div>
        <div class="actions">
          <button class="btn secondary" id="options">${t("btn_options")}</button>
        </div>
      </section>
    </main>
  `;
}

async function boot() {
  css();
  await render();
  document.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.action;
    if (action) await contentAction(action);
    if (target.id === "options") chrome.runtime.openOptionsPage();
  });
}

void boot();
