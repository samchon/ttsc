/**
 * Shape of `public/benchmark/evidence.json`, the evidence benchmark aggregate
 * served by the website.
 *
 * The file is copied from `benchmarks/evidence/aggregate/summary.json` by
 * `build/evidence-benchmark-data.cjs`, so this declares the same report the
 * benchmark package publishes, narrowed to what the page reads.
 */
export namespace ITtscWebsiteBenchmarkEvidence {
  /** The two arms: one workspace carries the graph, the other does not. */
  export type Arm = "plain" | "evidence";

  export interface Report {
    generatedAt: string;
    cells: Cell[];
  }

  /** Latest retained measurement for one model, subject, and arm. */
  export interface Cell {
    engine: string;
    subject: string;
    arm: Arm;
    runId: string;
    /** Benchmark commit the run was frozen at. Two revisions are two harnesses. */
    benchmarkRevision: string;
    model: string;
    effort: string;
    status: string;
    launchedAt: string;
    /** Cell total, including what judging its Reviews cost. */
    tokens: number;
    tokenUsage: TokenUsage;
    /** The judging share of `tokens` and `workElapsedMs`. */
    inspection: Inspection;
    /** Null when the retained requests did not reconcile with the totals. */
    apiCost: ApiCost | null;
    /** Verified non-working time already excluded from `workElapsedMs`. */
    suspendedMs: number;
    workElapsedMs: number;
    worktree: Worktree;
    /** Immutable Plain review decisions, empty for Evidence. */
    reviewVerdicts: ReviewVerdict[];
    stages: Stage[];
  }

  export interface TokenUsage {
    totalTokens: number;
    inputTokens: number;
    /** Included in `inputTokens`. */
    cachedInputTokens: number;
    cacheWriteInputTokens: number;
    outputTokens: number;
    /** Included in `outputTokens`. */
    reasoningOutputTokens: number;
  }

  export interface Inspection {
    attempts: number;
    failures: number;
    tokenUsage: TokenUsage;
    elapsedMs: number;
  }

  export interface ApiCost {
    provider: string;
    pricingAsOf: string;
    currency: string;
    amountUsd: number;
    requests: number;
  }

  export interface Worktree {
    files: number;
    additions: number;
    deletions: number;
  }

  export interface ReviewVerdict {
    scope: "backend" | "frontend" | "overall";
    attempt: number;
    decision: "pass" | "fail";
    action: string;
  }

  /** Retained token and work-time share attributed to one instruction. */
  export interface Stage {
    name: string;
    tokens: number;
    elapsedMs: number;
  }

  /**
   * Shape of `public/benchmark/evidence-coverage.json`, when a cohort has one.
   *
   * Coverage is counted by hand from a completed Plain workspace, so a
   * published cohort may not have it yet and the page omits the block rather
   * than drawing zeroes.
   */
  export interface CoverageReport {
    cells: CoverageCell[];
  }

  export interface CoverageCell {
    model: string;
    subject: string;
    arm: Arm;
    coverage: Coverage;
  }

  export interface Coverage {
    /** False for an arm that is complete by construction. */
    measured: boolean;
    /** Share of the reference graph satisfied, from 0 to 1. */
    score: number | null;
  }
}
