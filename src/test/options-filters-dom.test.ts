import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { MessageRequest } from "../shared/messages";

afterEach(() => vi.unstubAllGlobals());

it("places Filter below Sortierung and autosaves optional filter choices without changing other preferences", async () => {
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  const settings = { ...DEFAULT_SETTINGS, language: "de", search: { extraPagesToLoad: 7, homePagesToLoad: 2 } };
  const sendMessage = vi.fn(async (message: MessageRequest) => {
    if (message.type === "GET_SETTINGS") return { settings };
    if (message.type === "GET_CACHE_STATS") return { stats: { tours: 0, waypoints: 0, routes: 0, bytesInUse: 0 } };
    return { ok: true };
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test/${path}` } });
  await import("../options/options");
  await vi.waitFor(() => expect(document.querySelector('[data-nav="filters"]')).not.toBeNull());
  const nav = [...document.querySelectorAll<HTMLElement>("[data-nav]")].map((el) => el.dataset.nav);
  expect(nav[nav.indexOf("sort") + 1]).toBe("filters");
  document.querySelector<HTMLButtonElement>('[data-nav="filters"]')!.click();
  expect(document.querySelector('[data-panel="filters"]')!.hasAttribute("hidden")).toBe(false);
  for (const key of ["snowshoe", "via-ferrata"]) {
    const checkbox = document.querySelector<HTMLInputElement>(`#filter-visible-${key}`)!;
    expect(checkbox.checked).toBe(false);
    checkbox.click();
  }
  document.querySelector<HTMLInputElement>("#filter-visible-ski")!.click();
  await vi.waitFor(() => expect(sendMessage.mock.calls.filter(([message]) => message.type === "SAVE_SETTINGS")).toHaveLength(3));
  const saved = sendMessage.mock.calls.filter(([message]) => message.type === "SAVE_SETTINGS").at(-1)![0];
  if (saved.type !== "SAVE_SETTINGS") throw new Error("Expected saved settings");
  expect(saved.settings.filters).toMatchObject({ snowshoe: true, "via-ferrata": true, ski: false });
  expect(saved.settings.search).toEqual(settings.search);
  expect(saved.settings.sort).toEqual(settings.sort);
  const climbMin = document.querySelector<HTMLSelectElement>("#filter-range-climb-min")!;
  const climbMax = document.querySelector<HTMLSelectElement>("#filter-range-climb-max")!;
  const hikeMax = document.querySelector<HTMLSelectElement>("#filter-range-hike-max")!;
  expect(climbMin.value).toBe("100");
  expect(climbMax.selectedOptions[0].textContent).toBe("XI+");
  climbMax.value = "300";
  climbMax.dispatchEvent(new Event("change", { bubbles: true }));
  hikeMax.value = "530";
  hikeMax.dispatchEvent(new Event("change", { bubbles: true }));
  const lastSave = () => sendMessage.mock.calls.filter(([m]) => m.type === "SAVE_SETTINGS").at(-1)![0];
  await vi.waitFor(() => expect(lastSave()).toMatchObject({ settings: {
    filterSliderRanges: { hike: { min: 100, max: 530 }, climb: { min: 100, max: 300 } },
    filters: { snowshoe: true, ski: false }
  } }));
  climbMin.value = "400";
  climbMin.dispatchEvent(new Event("change", { bubbles: true }));
  expect(climbMax.value).toBe("400");
  expect(lastSave()).toMatchObject({ settings: { filterSliderRanges: { climb: { min: 400, max: 400 } } } });
});
