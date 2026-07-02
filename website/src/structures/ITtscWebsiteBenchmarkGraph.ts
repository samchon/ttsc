export namespace ITtscWebsiteBenchmarkGraph {
  export interface AgentSample {
    tokens: number;
    tools: number;
    graph?: number;
    shell?: number;
    durMs?: number;
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
  }

  export interface Metrics {
    tokens: number;
    tools: number;
    dur: number;
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
