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
  | "ttsc"
  | "ttsc+@ttsc/lint"
  | "eslint"
  | "@ttsc/lint"
  | "prettier";
export type BenchmarkOp = "build" | "noEmit" | "eslint" | "format";
/**
 * Threading variant the cell was measured under.
 *
 * - `single`: the run forces `--singleThreaded`. Parse, type-check, and the lint
 *   engine all run serially.
 * - `checkers2` / `checkers4` / `checkers8`: parse and the lint engine use the
 *   host's full CPU count, but the TypeScript-Go checker pool is capped at 2,
 *   4, or 8 workers via `--checkers N`. The spectrum exposes the
 *   diminishing-returns shape of the checker pool independently of the parse
 *   parallelism.
 * - `multi`: the bare command with no threading flag. Legacy measurements use it
 *   for tools that do not expose ttsc's threading axis, and format measurements
 *   use it for the default `ttsc format` run because `--checkers N` does not
 *   control formatter worker count.
 *
 * Build, type-check, and lint cells no longer emit `multi`; a one-time snapshot
 * may still carry it in the file. The dashboard tolerates that legacy value and
 * renders it as the top of the spectrum.
 */
export type BenchmarkThreading =
  | "single"
  | "checkers2"
  | "checkers4"
  | "checkers8"
  | "multi";

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
   * Median `@ttsc/lint` check sidecar wall-clock time parsed from `ttsc
   * --diagnostics`. Present only for `ttsc-lint` build/check cells recorded by
   * newer benchmark runs.
   */
  lintMedianMs?: number;
  /** Fastest measured `@ttsc/lint` sidecar run in milliseconds. */
  lintMinMs?: number;
  /** Raw per-run `@ttsc/lint` sidecar samples in milliseconds. */
  lintSamples?: number[];
  /**
   * Median native `@ttsc/lint` time parsed from the lint sidecar's own
   * diagnostics timing. This is the green lint segment in the dashboard.
   */
  lintPluginMedianMs?: number;
  /** Fastest measured native `@ttsc/lint` run in milliseconds. */
  lintPluginMinMs?: number;
  /** Raw per-run native `@ttsc/lint` samples in milliseconds. */
  lintPluginSamples?: number[];
  /**
   * Median third-party transform-host wall-clock time parsed from `ttsc
   * --diagnostics`. Present when a `ttsc-lint` check/build cell also runs
   * source transform plugins such as typia or nestia.
   */
  transformHostMedianMs?: number;
  /** Fastest measured transform-host run in milliseconds. */
  transformHostMinMs?: number;
  /** Raw per-run transform-host samples in milliseconds. */
  transformHostSamples?: number[];
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
  /** Installed TypeScript version in the fixture's legacy clone. */
  typescript?: string;
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
  typescript: string;
}

export interface BenchmarkReport {
  date: string;
  runs?: number;
  warmup?: number;
  host: BenchmarkHost;
  projects: BenchmarkProject[];
}
