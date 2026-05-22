/**
 * Formatting helpers shared across the benchmark dashboard widgets.
 *
 * Kept free of React so they can be unit-reasoned and reused by both the
 * project cards and the host-spec panel without pulling in JSX.
 */

import type { BenchmarkMeasurement } from "./types";

/** Human-friendly wall-clock label: sub-second in `ms`, otherwise `s`. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}

/** Speedup multiplier label, e.g. `2.5x`. */
export function formatMultiplier(factor: number): string {
  return `${factor.toFixed(factor < 10 ? 1 : 0)}x`;
}

/**
 * A speedup pairs a slow baseline against a faster ttsc measurement.
 * `factor` is baseline / fast — how many times faster ttsc ran.
 */
export interface Speedup {
  id: string;
  label: string;
  detail: string;
  baseline: { tool: string; ms: number };
  fast: { tool: string; ms: number };
  factor: number;
}

interface FindOptions {
  branch?: BenchmarkMeasurement["branch"];
  tool?: BenchmarkMeasurement["tool"];
  op?: BenchmarkMeasurement["op"];
  threading?: BenchmarkMeasurement["threading"];
}

/** First measurement matching every provided dimension, or `undefined`. */
export function findMeasurement(
  measurements: BenchmarkMeasurement[],
  options: FindOptions,
): BenchmarkMeasurement | undefined {
  return measurements.find(
    (m) =>
      (options.branch === undefined || m.branch === options.branch) &&
      (options.tool === undefined || m.tool === options.tool) &&
      (options.op === undefined || m.op === options.op) &&
      (options.threading === undefined || m.threading === options.threading),
  );
}

/**
 * Derive every speedup the supplied measurements support. Gracefully skips a
 * comparison whenever one side is missing or recorded as `0` (not measured),
 * so a project with a partial result set still renders cleanly.
 */
export function deriveSpeedups(
  measurements: BenchmarkMeasurement[],
): Speedup[] {
  const out: Speedup[] = [];

  const push = (
    id: string,
    label: string,
    detail: string,
    baseline: BenchmarkMeasurement | undefined,
    fast: BenchmarkMeasurement | undefined,
  ) => {
    if (!baseline || !fast) return;
    if (baseline.medianMs <= 0 || fast.medianMs <= 0) return;
    out.push({
      id,
      label,
      detail,
      baseline: { tool: baseline.tool, ms: baseline.medianMs },
      fast: { tool: fast.tool, ms: fast.medianMs },
      factor: baseline.medianMs / fast.medianMs,
    });
  };

  // Build: tsc vs ttsc.
  push(
    "build",
    "Build",
    "type-check and emit JS + .d.ts",
    findMeasurement(measurements, {
      branch: "legacy",
      tool: "tsc",
      op: "build",
    }),
    findMeasurement(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op: "build",
      threading: "multi",
    }),
  );

  // Type-check only: tsc --noEmit vs ttsc --noEmit.
  push(
    "noEmit",
    "Type-check",
    "check the project with --noEmit",
    findMeasurement(measurements, {
      branch: "legacy",
      tool: "tsc",
      op: "noEmit",
    }),
    findMeasurement(measurements, {
      branch: "ttsc",
      tool: "ttsc",
      op: "noEmit",
      threading: "multi",
    }),
  );

  // Threading: single-threaded ttsc vs multi-threaded ttsc.
  const stBuild = findMeasurement(measurements, {
    branch: "ttsc",
    threading: "single",
    op: "build",
  });
  const mtBuild = findMeasurement(measurements, {
    branch: "ttsc",
    threading: "multi",
    op: "build",
  });
  const stNoEmit = findMeasurement(measurements, {
    branch: "ttsc",
    threading: "single",
    op: "noEmit",
  });
  const mtNoEmit = findMeasurement(measurements, {
    branch: "ttsc",
    threading: "multi",
    op: "noEmit",
  });
  push(
    "threading",
    "Parallelism",
    "ttsc default vs --singleThreaded",
    stBuild ?? stNoEmit,
    stBuild ? mtBuild : mtNoEmit,
  );

  // Format: prettier vs @ttsc/lint format.
  push(
    "format",
    "Format",
    "rewrite the source tree",
    findMeasurement(measurements, { tool: "prettier" }),
    findMeasurement(measurements, { tool: "@ttsc/lint", op: "format" }),
  );

  return out;
}

/** Largest speedup across a project — drives the hero multiplier callout. */
export function headlineSpeedup(speedups: Speedup[]): Speedup | undefined {
  return speedups.reduce<Speedup | undefined>(
    (best, s) => (best === undefined || s.factor > best.factor ? s : best),
    undefined,
  );
}
