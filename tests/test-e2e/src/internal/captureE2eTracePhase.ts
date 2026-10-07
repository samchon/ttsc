import path from "node:path";

import { E2eCacheObservations } from "./E2eCacheObservations";
import {
  type PreparedAssetObservation,
  type PreparedAssetSelection,
  captureE2ePreparedAssets,
} from "./captureE2ePreparedAssets";
import {
  type TraceMeasurements,
  readE2eTraceMeasurements,
} from "./readE2eTraceMeasurements";

/**
 * Brackets one explicitly selected operation with file/cache/trace
 * observations. This helper never starts a runner, selects a family or
 * certifies child joins. The operation owner must settle its requests and join
 * its owned writers before returning; callback completion itself is not
 * evidence of that responsibility. Phase labels belong only to this returned
 * coordinator record.
 *
 * @evidence contracts/common.md#principled-implementation Preserves the original operation's returned value or thrown error separately from observation failures, using actual monotonic duration and native before/after observations at the unchanged opt-in root.
 * @evidence contracts/common.md#clear-and-simple-design One explicit operation and preparation list produce one phase record. It delegates file, cache and writer observations to their owning helpers rather than inventing expected process populations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not launch a replacement host, mutate trace environment, infer joins from callback completion or certify total process/Program reductions from observed counters.
 * @evidence contracts/common.md#meaningful-documentation Explains the phase-local label, original outcome preservation, required caller joins and separate completeness responsibility.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native explicit path selection, actual monotonic process time and writer observations. Runtime version/path reports do not certify selected executable byte equality or filesystem case capability.
 * @evidence contracts/performance.md#efficient-algorithms Captures each explicit preparation/cache namespace before and after, then parses the actual trace stream once. Costs scale with selected file bytes, native entries and trace events; this overhead must be enabled identically in both comparisons.
 * @evidence contracts/performance.md#reuse-equivalent-work Retains the prior sequence cursor to separate completed phases at one fixed root; preparations are observed again rather than reusing a stale file/cache verdict.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Observation reads close synchronously. Returned snapshots/events/errors remain caller-owned; actual child joins, bounded trace-file retention and scratch cleanup are not acquired or performed by this helper.
 */
export async function captureE2eTracePhase<T>(
  input: TracePhaseInput,
  operation: () => Promise<T>,
): Promise<TracePhaseObservation<T>> {
  const traceRoot = input.traceRoot;
  const label = input.label;
  const assets = input.assets.map((asset) => ({ ...asset }));
  const cacheRoots = [...input.cacheRoots];
  const afterSequences = { ...input.afterSequences };
  if (!path.isAbsolute(traceRoot) || process.env.TTSC_E2E_TRACE !== traceRoot)
    throw new Error("Trace phase requires the unchanged absolute opt-in root");
  const assetsBefore = captureE2ePreparedAssets(assets);
  const cachesBefore = E2eCacheObservations.capture(cacheRoots);
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();
  let outcome: TracePhaseObservation<T>["outcome"];
  try {
    outcome = { returned: true, value: await operation() };
  } catch (error) {
    outcome = { returned: false, error };
  }
  const elapsedNanoseconds = (process.hrtime.bigint() - start).toString();
  const finishedAt = new Date().toISOString();
  const observationErrors: { owner: string; error: unknown }[] = [];
  let assetsAfter: PreparedAssetObservation[] | undefined;
  let cachesAfter: E2eCacheObservations.Snapshot | undefined;
  let traces: TraceMeasurements | undefined;
  // Collect every independent post-operation observation even if another fails.
  try {
    assetsAfter = captureE2ePreparedAssets(assets);
  } catch (error) {
    observationErrors.push({ owner: "prepared-assets", error });
  }
  try {
    cachesAfter = E2eCacheObservations.capture(cacheRoots);
  } catch (error) {
    observationErrors.push({ owner: "cache-entries", error });
  }
  try {
    traces = readE2eTraceMeasurements(
      traceRoot,
      input.requiredWriterPids,
      afterSequences,
    );
  } catch (error) {
    observationErrors.push({ owner: "trace-writers", error });
  }
  if (process.env.TTSC_E2E_TRACE !== traceRoot)
    observationErrors.push({
      owner: "trace-root",
      error: new Error("Opt-in root changed during phase"),
    });
  return {
    label,
    traceRoot,
    startedAt,
    finishedAt,
    elapsedNanoseconds,
    coordinator: {
      runtimeVersion: process.version,
      executable: process.execPath,
      pid: process.pid,
    },
    outcome,
    assetsBefore,
    assetsAfter,
    cachesBefore,
    cachesAfter,
    cacheDelta: cachesAfter
      ? E2eCacheObservations.difference(cachesBefore, cachesAfter)
      : undefined,
    traces,
    requiredWriterPids: [...input.requiredWriterPids],
    observationErrors,
    completenessCertified: false,
  };
}

/** Explicit preparation and phase cursor; no phase value enters product input. */
export interface TracePhaseInput {
  label: string;
  traceRoot: string;
  assets: readonly PreparedAssetSelection[];
  cacheRoots: readonly string[];
  requiredWriterPids: readonly number[];
  afterSequences?: Readonly<Record<string, number>>;
}

/** Original outcome and observation failure are independent result dimensions. */
export interface TracePhaseObservation<T> {
  label: string;
  /** Actual fixed coordinator-selected root used for this observation. */
  traceRoot: string;
  startedAt: string;
  finishedAt: string;
  elapsedNanoseconds: string;
  coordinator: { runtimeVersion: string; executable: string; pid: number };
  outcome: { returned: true; value: T } | { returned: false; error: unknown };
  assetsBefore: PreparedAssetObservation[];
  assetsAfter?: PreparedAssetObservation[];
  cachesBefore: E2eCacheObservations.Snapshot;
  cachesAfter?: E2eCacheObservations.Snapshot;
  cacheDelta?: E2eCacheObservations.Delta[];
  traces?: TraceMeasurements;
  requiredWriterPids: number[];
  observationErrors: { owner: string; error: unknown }[];
  completenessCertified: false;
}
