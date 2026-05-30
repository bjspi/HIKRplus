import { t } from "../../shared/i18n";
import { sendMessage } from "../../shared/messages";
import type { ExtensionSettings } from "../../shared/types";
import type { HikrFeature } from "../feature-types";

const FORM_KEY = "hikr.ext.explore.form";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function newPresetId(): string {
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function collectForm(form: HTMLFormElement): Record<string, string | boolean> {
  const data: Record<string, string | boolean> = {};
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((input) => {
    if (!input.name || !input.offsetParent) return;
    if (input instanceof HTMLInputElement && ["button", "submit", "reset", "hidden"].includes(input.type)) return;
    if (input.name === "rando_hours" || input.name === "rando_minutes") return;
    if (input instanceof HTMLInputElement && input.type === "radio") {
      if (input.checked) data[input.name] = input.value;
    } else if (input instanceof HTMLInputElement && input.type === "checkbox") data[input.name] = input.checked;
    else data[input.name] = input.value;
  });
  return data;
}

function restoreForm(form: HTMLFormElement, data: Record<string, string | boolean>) {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((input) => {
    if (!input.name || !(input.name in data) || !input.offsetParent) return;
    const value = data[input.name];
    if (input instanceof HTMLInputElement && input.type === "radio") input.checked = String(value) === input.value;
    else if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = value === true;
    else input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function renderPresetPicker(form: HTMLFormElement, initialSettings: ExtensionSettings): void {
  if (form.querySelector(".hikr-ext-search-presets")) return;
  let settings = initialSettings;
  const wrapper = document.createElement("div");
  wrapper.className = "hikr-ext-search-presets";
  form.prepend(wrapper);

  const draw = () => {
    const presets = [...settings.searchPresets].sort((a, b) => a.name.localeCompare(b.name));
    const hasPresets = presets.length > 0;
    wrapper.innerHTML = `
      <div class="hikr-ext-search-presets-field">
        <label for="hikr-ext-search-preset">${t("search_preset_label")}</label>
        <select id="hikr-ext-search-preset" class="hikr-ext-form-select" ${hasPresets ? "" : "disabled"}>
          <option value="">${hasPresets ? t("search_preset_select") : t("search_preset_no_entries")}</option>
          ${presets.map((preset) => `<option value="${esc(preset.id)}">${esc(preset.name)}</option>`).join("")}
        </select>
      </div>
      <div class="hikr-ext-search-presets-actions">
        <button type="button" class="hikr-ext-form-button" data-hikr-search-preset-save>${t("search_preset_save")}</button>
        <button type="button" class="hikr-ext-form-button" data-hikr-search-preset-delete ${hasPresets ? "" : "disabled"}>${t("search_preset_delete")}</button>
      </div>
    `;
  };

  draw();

  wrapper.addEventListener("change", (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("#hikr-ext-search-preset");
    if (!select?.value) return;
    const preset = settings.searchPresets.find((entry) => entry.id === select.value);
    if (preset) restoreForm(form, preset.fields);
  });

  wrapper.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-hikr-search-preset-save]")) {
      const name = prompt(t("search_preset_name_prompt"), "");
      if (!name?.trim()) {
        alert(t("search_preset_name_required"));
        return;
      }
      const trimmed = name.trim();
      const existing = settings.searchPresets.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase());
      const now = Date.now();
      const preset = existing
        ? { ...existing, name: trimmed, fields: collectForm(form), updatedAt: now }
        : { id: newPresetId(), name: trimmed, fields: collectForm(form), createdAt: now, updatedAt: now };
      const next = existing
        ? settings.searchPresets.map((entry) => entry.id === existing.id ? preset : entry)
        : [...settings.searchPresets, preset];
      const response = await sendMessage<{ settings: ExtensionSettings }>({ type: "SAVE_SEARCH_PRESETS", searchPresets: next });
      settings = response.settings;
      draw();
      const select = wrapper.querySelector<HTMLSelectElement>("#hikr-ext-search-preset");
      if (select) select.value = preset.id;
      return;
    }
    if (target.closest("[data-hikr-search-preset-delete]")) {
      const select = wrapper.querySelector<HTMLSelectElement>("#hikr-ext-search-preset");
      if (!select?.value) return;
      const preset = settings.searchPresets.find((entry) => entry.id === select.value);
      if (!preset) return;
      if (!confirm(t("search_preset_confirm_delete", { name: preset.name }))) return;
      const response = await sendMessage<{ settings: ExtensionSettings }>({
        type: "SAVE_SEARCH_PRESETS",
        searchPresets: settings.searchPresets.filter((entry) => entry.id !== preset.id)
      });
      settings = response.settings;
      draw();
    }
  });
}

function attachCoordGeocode(coords: HTMLInputElement): void {
  if (coords.dataset.hikrGeoReady) return;
  coords.dataset.hikrGeoReady = "true";
  coords.setAttribute("autocomplete", "off");

  const wrap = document.createElement("div");
  wrap.className = "hikr-ext-suggest-wrap";
  coords.parentNode!.insertBefore(wrap, coords);
  wrap.appendChild(coords);

  const list = document.createElement("ul");
  list.className = "hikr-ext-suggest-list";
  list.hidden = true;
  wrap.appendChild(list);

  let timer: number | undefined;
  let seq = 0;
  function hide() { list.hidden = true; list.innerHTML = ""; }

  const isRawCoords = (q: string) => /^-?\d+[.,]\d+\s*,\s*-?\d+[.,]\d+$/.test(q.trim());

  coords.addEventListener("input", () => {
    window.clearTimeout(timer);
    const query = coords.value.trim();
    if (isRawCoords(query) || query.length < 3) { hide(); return; }
    const s = ++seq;
    timer = window.setTimeout(async () => {
      try {
        const response = await sendMessage({ type: "GEOCODE_SUGGESTIONS", query });
        if (s !== seq) return;
        const geocodes = "geocodes" in response ? response.geocodes : [];
        if (!geocodes.length) { hide(); return; }
        list.innerHTML = geocodes.map((item) =>
          `<li><button type="button" data-lat="${item.coordinates.lat}" data-lng="${item.coordinates.lng}">${esc(item.displayName)}</button></li>`
        ).join("");
        list.hidden = false;
      } catch { hide(); }
    }, 600);
  });

  list.addEventListener("mousedown", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-lat]");
    if (!btn) return;
    event.preventDefault();
    coords.value = `${btn.dataset.lat},${btn.dataset.lng}`;
    coords.dispatchEvent(new Event("change", { bubbles: true }));
    hide();
    coords.focus();
  });

  coords.addEventListener("blur", () => window.setTimeout(hide, 150));
  coords.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
}

function renderLocationPicker(form: HTMLFormElement, settings: ExtensionSettings): void {
  const coords = form.querySelector<HTMLInputElement>('input[name="coordinates"]');
  if (!coords) return;
  const host = coords.closest("tr")?.parentElement?.parentElement?.parentElement
    ?? coords.parentElement;
  if (!host) return;
  if (host.querySelector(".hikr-ext-saved-locations")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "hikr-ext-saved-locations";
  host.insertAdjacentElement("afterend", wrapper);

  const entries = [...settings.savedLocations].sort((a, b) => a.name.localeCompare(b.name));
  const hasEntries = entries.length > 0;
  const optionsHtml = entries
    .map((entry) => `<option value="${entry.coordinates}">${entry.name} (${entry.coordinates})</option>`)
    .join("");

  wrapper.innerHTML = `
    <div class="hikr-ext-saved-locations-field">
      <label for="hikr-ext-saved-pick">${t("saved_location_label")}</label>
      <select id="hikr-ext-saved-pick" class="hikr-ext-form-select hikr-ext-saved-select" ${hasEntries ? "" : "disabled"}>
        <option value="">${hasEntries ? t("saved_location_select") : t("saved_location_no_entries")}</option>
        ${optionsHtml}
      </select>
    </div>
    <button type="button" class="hikr-ext-form-button hikr-ext-saved-manage">${t("saved_location_open_options")}</button>
  `;

  wrapper.querySelector<HTMLSelectElement>(".hikr-ext-saved-select")!.addEventListener("change", (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (!value) return;
    coords.value = value;
    coords.dispatchEvent(new Event("change", { bubbles: true }));
  });
  wrapper.querySelector<HTMLButtonElement>(".hikr-ext-saved-manage")!.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" }).catch(() => undefined);
  });

  attachCoordGeocode(coords);
}

export const exploreFormFeature: HikrFeature = {
  id: "exploreFormRestore",
  title: "Explore Form Restore",
  defaultEnabled: true,
  matchesPage: (context) => context.hasExploreForm,
  run({ settings }) {
    const form = document.querySelector<HTMLFormElement>('form[action*="filter.php"]');
    if (!form) return;
    const saved = localStorage.getItem(FORM_KEY) ?? localStorage.getItem("formData");
    if (saved) {
      try {
        const data = JSON.parse(saved) as Record<string, string | boolean>;
        restoreForm(form, data);
        setTimeout(() => restoreForm(form, data), 150);
      } catch (error) {
        console.warn("HIKR form restore failed", error);
      }
    }
    form.addEventListener("change", () => {
      localStorage.setItem(FORM_KEY, JSON.stringify(collectForm(form)));
    });
    renderPresetPicker(form, settings);
    if (settings.features.savedLocations) renderLocationPicker(form, settings);
  }
};
