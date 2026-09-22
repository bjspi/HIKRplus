import { HIKE_FILTER_STEPS, CLIMB_FILTER_STEPS } from "./difficulty";

export const SLIDER_SCALES = { hike: HIKE_FILTER_STEPS, climb: CLIMB_FILTER_STEPS };
export type SliderKey = keyof typeof SLIDER_SCALES;
export type FilterSliderRanges = Record<SliderKey, { min: number; max: number }>;
export type FilterSliderRangeInput = Partial<Record<SliderKey, Partial<FilterSliderRanges[SliderKey]>>>;

// Store native grade values, never positions in a shortened slider.
export function resolveFilterSliderRanges(value?: FilterSliderRangeInput): FilterSliderRanges {
  const result = {} as FilterSliderRanges;
  for (const key of ["hike", "climb"] as const) {
    const steps = SLIDER_SCALES[key];
    const valid = (n: unknown): n is number => typeof n === "number" && steps.some((s) => s.value === n);
    const raw = value?.[key];
    const min = valid(raw?.min) ? raw.min : steps[0].value;
    const max = valid(raw?.max) ? raw.max : steps[steps.length - 1].value;
    result[key] = { min: Math.min(min, max), max: Math.max(min, max) };
  }
  return result;
}

export const FILTER_OPTIONS = [
  { key: "hike", labelKey: "filter_hike" },
  { key: "climb", labelKey: "filter_climb" },
  { key: "mountaineering", labelKey: "filter_mountaineering" },
  { key: "ski", labelKey: "filter_ski" },
  { key: "mountainbike", labelKey: "filter_mountainbike" },
  { key: "via-ferrata", labelKey: "filter_via_ferrata" },
  { key: "ice-climbing", labelKey: "filter_ice_climbing" },
  { key: "snowshoe", labelKey: "filter_snowshoe" },
  { key: "drive", labelKey: "filter_drive" },
  { key: "geodata", labelKey: "filter_geodata" }
] as const;

export type FilterKey = typeof FILTER_OPTIONS[number]["key"];
export type FilterVisibility = Record<FilterKey, boolean>;

export const DEFAULT_FILTER_VISIBILITY: FilterVisibility = {
  hike: true, climb: true, mountaineering: true, ski: true, mountainbike: true,
  "via-ferrata": false, "ice-climbing": true, snowshoe: false, drive: true, geodata: true
};

export function resolveFilterVisibility(value?: Partial<FilterVisibility>): FilterVisibility {
  const result = { ...DEFAULT_FILTER_VISIBILITY };
  for (const { key } of FILTER_OPTIONS) {
    if (typeof value?.[key] === "boolean") result[key] = value[key];
  }
  return result;
}
