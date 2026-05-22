/**
 * Shape of `public/benchmark.json` — the committed, served benchmark result file.
 *
 * The benchmark runner (`experimental/benchmark`) drops real medians in later;
 * the schema is intentionally sparse so a project may carry only some of the
 * branch × tool × op × threading combinations.
 */

export type BenchmarkBranch = "legacy" | "ttsc" | "ttsc-lint";
export type BenchmarkTool =
  | "tsc"
  | "ttsc"
  | "eslint"
  | "@ttsc/lint"
  | "prettier";
export type BenchmarkOp = "build" | "noEmit" | "format";
export type BenchmarkThreading = "single" | "multi";

export interface BenchmarkMeasurement {
  branch: BenchmarkBranch;
  tool: BenchmarkTool;
  op: BenchmarkOp;
  threading: BenchmarkThreading;
  /** Median wall-clock time in milliseconds across the measured runs. */
  medianMs: number;
}

export interface BenchmarkProject {
  name: string;
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
  typescript: string;
}

export interface BenchmarkReport {
  date: string;
  host: BenchmarkHost;
  projects: BenchmarkProject[];
}
