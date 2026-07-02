/**
 * Shape of `public/benchmark/performance.json`, the committed benchmark result
 * served by the website.
 */
export namespace ITtscWebsiteBenchmark {
  export type Branch = "legacy" | "ttsc" | "ttsc-lint";

  export type Tool =
    | "tsc"
    | "tsgo"
    | "ttsc"
    | "ttsc+@ttsc/lint"
    | "eslint"
    | "@ttsc/lint"
    | "prettier";

  export type Operation = "build" | "noEmit" | "eslint" | "format";

  export type Threading =
    | "single"
    | "checkers2"
    | "checkers4"
    | "checkers8"
    | "multi";

  export type FailureKind = "race" | "error";

  export interface Measurement {
    branch: Branch;
    tool: Tool;
    op: Operation;
    threading: Threading;
    samples: number[];
    lintSamples?: number[];
    lintPluginSamples?: number[];
    transformHostSamples?: number[];
    raceRetries?: number;
    failure?: FailureKind;
    exitStatus?: number;
  }

  export interface Project {
    name: string;
    repo?: string;
    files: number;
    kind: string;
    typescript?: string;
    tsgo?: string;
    measurements: Measurement[];
  }

  export interface Host {
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

  export interface Report {
    date: string;
    runs?: number;
    warmup?: number;
    host: Host;
    projects: Project[];
  }

  export interface Speedup {
    id: string;
    label: string;
    detail: string;
    baseline: { tool: string; ms: number };
    fast: { tool: string; ms: number };
    factor: number;
    referenceOnly?: boolean;
  }

  export type MeasurementOptions = Partial<
    Pick<Measurement, "branch" | "tool" | "op" | "threading">
  >;
}
