import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginWork,
  endWork,
  isIdle,
  onPipelineChange,
  outstanding,
  resetPipeline
} from "../content/pipeline-status";

beforeEach(() => {
  resetPipeline();
});

describe("pipeline-status", () => {
  it("is not idle before any work has started (started guard)", () => {
    expect(isIdle()).toBe(false);
    expect(outstanding()).toBe(0);
  });

  it("stays busy while pagination is still running, even as tours come and go", () => {
    // Pagination loop is held open the whole time it prefetches pages.
    beginWork("pagination");
    // A few tours enrich and finish during pagination...
    beginWork("enrich");
    beginWork("enrich");
    endWork("enrich");
    endWork("enrich");
    // ...but we must NOT report idle: pagination has not finished, more pages (and
    // therefore more tours) may still arrive. This is the "page hangs" guarantee.
    expect(isIdle()).toBe(false);

    endWork("pagination");
    expect(isIdle()).toBe(true);
  });

  it("hands off enrich → route without a false-idle gap", () => {
    beginWork("enrich");
    expect(isIdle()).toBe(false);

    // A tour's waypoint became known: routing is registered BEFORE the enrich work
    // is counted down, so the totals never momentarily hit zero mid-pipeline.
    beginWork("route");
    endWork("enrich");
    expect(isIdle()).toBe(false);

    endWork("route");
    expect(isIdle()).toBe(true);
  });

  it("notifies listeners and never reports negative counts", () => {
    const seen: number[] = [];
    onPipelineChange(() => seen.push(outstanding()));
    beginWork("route");
    endWork("route");
    endWork("route"); // extra end must not drive the count below zero
    expect(outstanding()).toBe(0);
    expect(seen).toEqual([1, 0, 0]);
  });

  it("tolerates a listener that unsubscribes during notification", () => {
    const calls = { a: 0, b: 0 };
    const offA = onPipelineChange(() => {
      calls.a++;
      offA(); // remove self mid-notify — must not break the iteration
    });
    onPipelineChange(() => {
      calls.b++;
    });
    beginWork("enrich");
    expect(calls).toEqual({ a: 1, b: 1 });
    endWork("enrich");
    // a unsubscribed itself, b keeps receiving
    expect(calls).toEqual({ a: 1, b: 2 });
  });

  it("becomes idle again only after everything settles", () => {
    const idleHits = vi.fn();
    onPipelineChange(() => {
      if (isIdle()) idleHits();
    });
    beginWork("pagination");
    beginWork("enrich");
    beginWork("enrich");
    endWork("enrich");
    endWork("pagination");
    expect(idleHits).not.toHaveBeenCalled();
    endWork("enrich");
    expect(idleHits).toHaveBeenCalledTimes(1);
  });
});
