/**
 * Shape of `public/benchmark.json` — the committed, served benchmark result
 * file.
 *
 * This file is the single canonical schema: the benchmark runner
 * (`experimental/benchmark/bench.mjs`) emits exactly this shape, and the
 * dashboard components render exactly this shape. The schema is intentionally
 * sparse so a project may carry only some of the branch × tool × op × threading
 * combinations; the dashboard skips any comparison whose pair is missing.
 *
 * Required fields drive the dashboard. Optional fields (`samples`, `minMs`,
 * stability) carry the runner's richer per-cell data through to the JSON so a
 * published result is fully reproducible; the dashboard does not depend on
 * them.
 */

export type BenchmarkBranch = "legacy" | "ttsc" | "ttsc-lint";
export type BenchmarkTool =
  | "tsc"
  | "tsgo"
  | "ttsc"
  | "ttsc+@ttsc/lint"
  | "eslint"
  | "@ttsc/lint"
  | "prettier";
export type BenchmarkOp = "build" | "noEmit" | "eslint" | "format";
export type BenchmarkThreading = "single" | "multi";

/**
 * How a measured run that exited non-zero was classified. `race` is the
 * intermittent TypeScript-Go parallel-emit data race (retried; a clean timing
 * is still recorded). `error` is a deterministic failure (the cell is left
 * unmeasured, so `medianMs` is `0`).
 */
export type BenchmarkFailureKind = "race" | "error";

export interface BenchmarkMeasurement {
  branch: BenchmarkBranch;
  tool: BenchmarkTool;
  op: BenchmarkOp;
  threading: BenchmarkThreading;
  /**
   * Median wall-clock time in milliseconds across the measured runs. `0` means
   * the cell could not be measured (a deterministic failure); the dashboard
   * skips any comparison touching a `0`.
   */
  medianMs: number;
  /** Fastest measured run in milliseconds, when at least one run succeeded. */
  minMs?: number;
  /** Raw per-run wall-clock samples in milliseconds, in run order. */
  samples?: number[];
  /**
   * Count of runs that hit the intermittent parallel-emit data race and were
   * retried. Absent or `0` means the cell measured cleanly.
   */
  raceRetries?: number;
  /** Kind of the deterministic failure when the cell could not be measured. */
  failure?: BenchmarkFailureKind;
  /** Process exit status when the cell failed deterministically. */
  exitStatus?: number;
}

export interface BenchmarkProject {
  name: string;
  repo?: string;
  files: number;
  kind: string;
  measurements: BenchmarkMeasurement[];
}

export interface BenchmarkHost {
  os: string;
  kernel: string;
  cpu: string;
  cores: number;
  ramGB: number;
  node: string;
  ttsc: string;
  tsgo: string;
  typescript: string;
}

export interface BenchmarkReport {
  date: string;
  runs?: number;
  warmup?: number;
  host: BenchmarkHost;
  projects: BenchmarkProject[];
}
