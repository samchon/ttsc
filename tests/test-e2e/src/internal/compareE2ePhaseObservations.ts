import assert from "node:assert/strict";

import type { TracePhaseObservation } from "./captureE2eTracePhase";

/**
 * Compare the retained admitted baseline with the actual consolidated phase.
 *
 * @evidence contracts/common.md#principled-implementation Uses captured monotonic duration and validated trace counters from both actual phases. Constructor events remain distinct from installed facades and observed process invocations remain distinct from unique physical children.
 * @evidence contracts/common.md#clear-and-simple-design Returns decimal wall-time differences and before/after/delta counter cells; original outcomes and cache observations remain beside those cells.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not certify whole upstream populations, deduplicate launches by PID, turn a negative delta into survivor coverage or assume equal cold cache temperature. Failed phase outcomes remain failed outcomes.
 * @evidence contracts/common.md#meaningful-documentation States the observed population and timing/cache limitations directly in the returned report.
 * @evidence contracts/portability.md#os-neutral-implementation Compares recorded integer counters and decimal monotonic durations without interpreting OS names, paths or signal spellings.
 * @evidence contracts/performance.md#efficient-algorithms Visits a fixed counter set once. Cache snapshots are referenced, not rescanned; caller serialization accounts for their retained bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses the already parsed baseline and phase observations, without another process, file read, producer preparation or trace scan.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns both captured phases and the returned summary until bounded report serialization completes. This pure projection owns no native handles and proves no child or descendant joins.
 */
export function compareE2ePhaseObservations(
  baseline: TracePhaseObservation<unknown>,
  consolidated: TracePhaseObservation<unknown>,
) {
  assert.ok(
    baseline.traces && consolidated.traces,
    "Comparison requires both actual trace observations",
  );
  assert.match(baseline.elapsedNanoseconds, /^\d+$/);
  assert.match(consolidated.elapsedNanoseconds, /^\d+$/);
  const observations: Record<
    string,
    { before: number; after: number; delta: number }
  > = {};
  for (const key of [
    "writerInstances",
    "processAttempts",
    "processStarts",
    "processExits",
    "processCloses",
    "installedDriverFacades",
    "bridgeCacheHits",
  ] as const) {
    const before = baseline.traces[key];
    const after = consolidated.traces[key];
    assert.ok(Number.isSafeInteger(before) && before >= 0);
    assert.ok(Number.isSafeInteger(after) && after >= 0);
    observations[key] = { before, after, delta: after - before };
  }
  for (const key of [
    "fullLoad",
    "fullReconstruction",
    "reusedDataGeneration",
    "other",
  ] as const) {
    const before = baseline.traces.programConstructions[key];
    const after = consolidated.traces.programConstructions[key];
    assert.ok(Number.isSafeInteger(before) && before >= 0);
    assert.ok(Number.isSafeInteger(after) && after >= 0);
    observations[`programConstruction.${key}`] = {
      before,
      after,
      delta: after - before,
    };
  }
  return {
    observedOnly: true,
    wallTimeNanoseconds: {
      before: baseline.elapsedNanoseconds,
      after: consolidated.elapsedNanoseconds,
      delta: (
        BigInt(consolidated.elapsedNanoseconds) -
        BigInt(baseline.elapsedNanoseconds)
      ).toString(),
      scope:
        "runner callback including enabled in-process instrumentation; preparation and post-phase scans excluded",
    },
    observations,
    processCounterScope:
      "distinct observed invocations; overlapping observers are not deduplicated physical launches",
    programCounterScope:
      "maintained driver constructor-return events; raw/upstream constructions are not inferred",
    outcomes: { before: baseline.outcome, after: consolidated.outcome },
    cachesBefore: {
      before: baseline.cachesBefore,
      after: consolidated.cachesBefore,
    },
    identicalColdTemperatureCertified: false,
    wholePopulationReductionCertified: false,
    assertionCoverageCertified: false,
    descendantJoinCertified: false,
  };
}
