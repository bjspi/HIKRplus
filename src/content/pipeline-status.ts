import { devLog } from "../shared/dev-log";
import type { Coordinates } from "../shared/types";

// Cross-feature DOM events used to pipeline the work without import cycles
// (routes.ts already imports tour-details, so a direct callback would be circular).
export const EVT_TOURS_APPENDED = "hikr:ext:tours-appended";
export const EVT_TOUR_READY = "hikr:ext:tour-ready";
export const EVT_PAGINATION_DONE = "hikr:ext:pagination-done";

export interface TourReadyDetail {
  detail: HTMLElement; // the .hikr-ext-tour-details element carrying data-lat/data-lng
  tourUrl: string;
  target: Coordinates;
}

// Tracks outstanding work across the three async producers that feed the result
// list: pagination (prefetching extra pages), enrichment (fetching tour + waypoint
// pages) and routing (driving-time calculation). Auto-sort needs to know when the
// whole pipeline has come to rest — but only when it is GENUINELY at rest.
//
// Robustness contract: a unit of work is only ever counted down when it has truly
// finished (in a finally block). A hung prefetch or a slow tour keeps its counter
// above zero, so `isIdle()` cannot report "done" prematurely. The producers also
// hand off without a gap: a tour that finishes enrichment registers its routing
// work (beginWork("route")) synchronously, before its enrichment work is counted
// down, so the totals never momentarily hit zero mid-pipeline.

export type PipelinePhase = "pagination" | "enrich" | "route";

const counts: Record<PipelinePhase, number> = { pagination: 0, enrich: 0, route: 0 };
let started = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* listener errors must not break the pipeline */
    }
  }
}

export function beginWork(phase: PipelinePhase, n = 1): void {
  if (n <= 0) return;
  counts[phase] += n;
  started = true;
  devLog("pipeline", "begin", phase, { ...counts });
  notify();
}

export function endWork(phase: PipelinePhase, n = 1): void {
  if (n <= 0) return;
  counts[phase] = Math.max(0, counts[phase] - n);
  devLog("pipeline", "end", phase, { ...counts });
  notify();
}

export function pipelineCounts(): Record<PipelinePhase, number> {
  return { ...counts };
}

export function outstanding(): number {
  return counts.pagination + counts.enrich + counts.route;
}

// Idle = at least one unit of work has been registered AND everything has finished.
// The `started` guard prevents a "done before anything began" false positive while
// features are still wiring up.
export function isIdle(): boolean {
  return started && outstanding() === 0;
}

export function onPipelineChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Clears all counters, the started flag and listeners. Used by tests, and as
// insurance if the content script is ever re-run without a full page reload (stale
// counters would otherwise make isIdle() lie).
export function resetPipeline(): void {
  counts.pagination = 0;
  counts.enrich = 0;
  counts.route = 0;
  started = false;
  listeners.clear();
}
