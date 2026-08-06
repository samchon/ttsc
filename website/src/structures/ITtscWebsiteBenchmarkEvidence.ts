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
    /**
     * Run this row was counted from, absent in a file counted before the field
     * existed. Publication refuses a row that cannot be attributed to the
     * cohort being written, so a file published after that check carries one.
     */
    runId?: string;
    coverage: Coverage;
  }

  export interface Coverage {
    /** False for an arm that is complete by construction. */
    measured: boolean;
    /** Share of the reference graph satisfied, from 0 to 1. */
    score: number | null;
    /** How whole an artifact of each kind is below itself, from 0 to 1. */
    wholeness: Wholeness;
    /** The thirteen measured edges the score is folded from. */
    edges: CoverageEdge[];
  }

  export interface Wholeness {
    test: number | null;
    journey: number | null;
    property: number | null;
    dto: number | null;
    screen: number | null;
    hook: number | null;
    api: number | null;
    model: number | null;
  }

  /** One reference edge: what share of its sources reach their target. */
  export interface CoverageEdge {
    name: string;
    /** Null when the populations behind the rate were not retained. */
    eligible: number | null;
    reached: number | null;
    rate: number | null;
  }
}
