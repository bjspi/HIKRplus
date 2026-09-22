import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTER_VISIBILITY, resolveFilterVisibility, resolveFilterSliderRanges } from "../shared/filter-settings";
import { DEFAULT_SETTINGS, loadSettings, patchSettings, saveSettings, SETTINGS_KEY } from "../shared/settings";

let stored: Record<string, unknown>;

beforeEach(() => {
  stored = {};
  vi.stubGlobal("chrome", { storage: { sync: {
    get: vi.fn(async () => stored),
    set: vi.fn(async (value) => { stored = structuredClone(value); })
  } } });
});
afterEach(() => vi.unstubAllGlobals());

describe("filter preferences", () => {
  it("stores native slider bounds and preserves them through unrelated saves", async () => {
    const filterSliderRanges = { hike: { min: 300, max: 530 }, climb: { min: 100, max: 300 } };
    await saveSettings({ ...DEFAULT_SETTINGS, filterSliderRanges });
    await patchSettings({ language: "it" });
    expect((await loadSettings()).filterSliderRanges).toEqual(filterSliderRanges);
    expect(resolveFilterSliderRanges({ climb: { min: 300, max: 100 } }).climb).toEqual({ min: 100, max: 300 });
    expect(resolveFilterSliderRanges({ hike: { min: -1, max: Number.NaN } }).hike).toEqual({ min: 100, max: 630 });
    expect(resolveFilterSliderRanges({ climb: { min: 200, max: 200 } }).climb).toEqual({ min: 200, max: 200 });
  });
  it("gives existing installations the new defaults without changing other settings", async () => {
    stored[SETTINGS_KEY] = { language: "fr", search: { extraPagesToLoad: 7 } };
    const settings = await loadSettings();
    expect(settings.filters).toEqual(DEFAULT_FILTER_VISIBILITY);
    expect(settings.filterSliderRanges).toEqual(resolveFilterSliderRanges());
    expect(settings.filters["via-ferrata"]).toBe(false);
    expect(settings.filters.snowshoe).toBe(false);
    expect(settings.language).toBe("fr");
    expect(settings.search.extraPagesToLoad).toBe(7);
  });

  it("persists opt-ins and opt-outs through unrelated preference updates", async () => {
    const filters = resolveFilterVisibility({ snowshoe: true, "via-ferrata": true, ski: false });
    await saveSettings({ ...DEFAULT_SETTINGS, filters });
    expect((await loadSettings()).filters).toEqual(filters);
    await patchSettings({ language: "it" });
    expect((await loadSettings()).filters).toEqual(filters);
    expect((await loadSettings()).language).toBe("it");
  });

  it("fills partial stored preferences and ignores malformed boolean values", async () => {
    stored[SETTINGS_KEY] = { filters: { snowshoe: true, ski: false, hike: "false", climb: null } };
    expect((await loadSettings()).filters).toEqual({ ...DEFAULT_FILTER_VISIBILITY, snowshoe: true, ski: false });
  });
});
