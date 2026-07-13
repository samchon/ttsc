export namespace ITtscWebsiteBenchmarkGraph {
  export interface AgentSample {
    tokens: number;
    tools: number;
    graph?: number;
    shell?: number;
    durMs?: number;
    /** Run cost in USD; absent on harnesses that do not report it (Codex). */
    cost?: number;
    /**
     * Cached-input tokens (a subset of `tokens`), when the harness reports
     * them.
     */
    cached?: number;
    /** Reasoning output tokens, counted separately from `tokens`. */
    reasoning?: number;
    [key: string]: unknown;
  }

  export interface AgentCell {
    harness: string;
    repo: string;
    model: string;
    modelVersion?: string;
    effort?: string;
    promptId?: string;
    promptFamily?: string;
    fixtureBranch?: string;
    daemon?: boolean;
    toolSetupMs?: number;
    runs?: number;
    tool?: string;
    question?: string;
    samples: {
      baseline: AgentSample[];
      graph: AgentSample[];
    };
  }

  export interface StructuralData {
    sourceFiles?: number;
    nodes?: number;
    externalNodes?: number;
    edges?: {
      heritage?: number;
      "type-ref"?: number;
      "value-call"?: number;
    };
    totalEdges?: number;
    symbolFiles?: number;
    coveredFiles?: number;
    coverage?: number;
    loadMsMedian?: number;
    buildMsMedian?: number;
  }

  export interface Report {
    structural?: StructuralData;
    agent?: {
      cells: AgentCell[];
    };
    index?: IndexData;
  }

  /**
   * What readiness costs: the cold build of each tool's index, per repository,
   * measured on one quiet machine.
   */
  export interface IndexData {
    host: IndexHost;

    /** The program each index was built from, keyed by repository. */
    scale: Record<string, IndexScale>;

    cells: IndexCell[];
  }

  export interface IndexHost {
    os: string;
    kernel?: string;
    cpu: string;
    cores: number;
    ramGB: number;
    node?: string;
  }

  export interface IndexScale {
    files: number;
    lines: number;
  }

  export interface IndexCell {
    project: string;
    tool: string;

    /** Wall-clock milliseconds of the cold build; null when it has no build. */
    buildMs: number | null;

    /**
     * False for a tool with no build step at all. It is not a zero: a missing
     * number and a zero are different claims.
     */
    hasBuildStep?: boolean;

    failed?: boolean;
  }

  export interface Metrics {
    tokens: number;
    tools: number;
    dur: number;
    /** Median run cost in USD; undefined when neither measured nor estimable. */
    cost?: number;
    /**
     * True when `cost` is estimated from tokens and API list prices, not
     * measured.
     */
    costEstimated?: boolean;
  }

  export interface ModelGroup {
    id: string;
    model: string;
    label: string;
    harness: string;
    effort?: string;
    fixtureBranch?: string;
    daemon: boolean;
    runs?: number;
    question?: string;
    codegraphSetupMs?: number;
    codebaseMemorySetupMs?: number;
    serenaSetupMs?: number;
    baseline: Metrics;
    ttsc?: Metrics;
    codegraph?: Metrics;
    codebaseMemory?: Metrics;
    serena?: Metrics;
  }

  export interface ProjectGroup {
    id: string;
    repo: string;
    promptId?: string;
    promptFamily: string;
    question?: string;
    models: ModelGroup[];
  }

  export interface PromptModeGroup {
    id: string;
    promptFamily: string;
    projects: ProjectGroup[];
  }

  export type ToolKey = "ttsc" | "codegraph" | "codebaseMemory" | "serena";
  export type ReductionSeriesKey = "baseline" | ToolKey;

  export interface ReductionTool {
    key: ToolKey;
    label: string;
    metrics?: Metrics;
    setupMs?: number;
    fill: string;
    textColor: string;
  }

  export interface ReductionRow {
    id: string;
    label: string;
    meta?: string;
    baseline: Metrics;
    tools: ReductionTool[];
  }
}
