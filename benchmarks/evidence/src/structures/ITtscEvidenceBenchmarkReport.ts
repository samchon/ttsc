import type { EvidenceBenchmarkArm } from "../typings/EvidenceBenchmarkArm";
import type { EvidenceBenchmarkEffort } from "../typings/EvidenceBenchmarkEffort";
import type { ITtscEvidenceBenchmarkApiCost } from "./ITtscEvidenceBenchmarkApiCost";
import type { ITtscEvidenceBenchmarkSuspension } from "./ITtscEvidenceBenchmarkSuspension";
import type { ITtscEvidenceBenchmarkTokenUsage } from "./ITtscEvidenceBenchmarkTokenUsage";

/** Publishable aggregate of the latest launched benchmark cells. */
export interface ITtscEvidenceBenchmarkReport {
  generatedAt: string;

  /**
   * Repository whose run records this cohort was collected from.
   *
   * Each cell already carries the `benchmarkRevision` its launcher read from
   * `HEAD`, and a bare SHA says nothing about where it resolves. An aggregate
   * vendored from another project is then indistinguishable from one this
   * repository measured, and the figures drawn from it read as this
   * repository's own.
   *
   * `report` writes it from the repository it scanned. It is optional because
   * an aggregate published before this field existed does not have one, and
   * back-filling it would put a value into a generated artifact that nothing
   * derived — which is the failure the field exists to prevent. Absence means
   * the origin is unrecorded, and whatever publishes such an aggregate states
   * it in prose instead.
   */
  origin?: string;

  cells: ITtscEvidenceBenchmarkReportCell[];
}

/** Latest retained measurement for one model, subject, and arm. */
export interface ITtscEvidenceBenchmarkReportCell {
  engine: "codex";
  subject: string;
  arm: EvidenceBenchmarkArm;
  runId: string;
  benchmarkRevision: string;
  model: string;
  effort: EvidenceBenchmarkEffort;
  /** Explicit external review-ledger treatment, when selected. */
  reviewLedger?: "backend";
  status:
    | "ready"
    | "running"
    | "checkpointed"
    | "awaiting-review-verdict"
    | "quality-failed"
    | "awaiting-supervision"
    | "rejected"
    | "interrupted"
    | "completed";
  stage: string | null;
  launchedAt: string;
  /** Cell total, including what judging its Reviews cost. */
  tokens: number;
  /** Cell total, including what judging its Reviews cost. */
  tokenUsage: ITtscEvidenceBenchmarkTokenUsage;
  /** The judging share of `tokens`, `tokenUsage`, and `workElapsedMs`. */
  inspection: ITtscEvidenceBenchmarkReportInspection;
  /**
   * Reconciled per-request price of the measured thread alone.
   *
   * Inspection is deliberately outside this number. The price is emitted only
   * after every retained request reconciles with the thread's own counters, and
   * an inspecting thread reports one aggregate for its whole turn, which cannot
   * be split back into the requests that rate table prices.
   */
  apiCost: ITtscEvidenceBenchmarkApiCost | null;
  /** Verified non-working time excluded from work measurements. */
  suspendedMs: number;
  /** Audit intervals behind `suspendedMs`. */
  suspensions: ITtscEvidenceBenchmarkReportSuspension[];
  /** Cell total, including what judging its Reviews cost. */
  workElapsedMs: number;
  worktree: ITtscEvidenceBenchmarkReportWorktree;
  /** Immutable Plain review verdict history, empty for Evidence. */
  reviewVerdicts: ITtscEvidenceBenchmarkReportReviewVerdict[];
  stages: ITtscEvidenceBenchmarkReportStage[];
}

/**
 * What judging one cell's Reviews cost, inside its totals and separable.
 *
 * Inspection is part of what an arm costs, so it is added rather than reported
 * beside the cell. It keeps its own record because a reader comparing two arms
 * needs to see how much of a total was the work and how much was the judging.
 */
export interface ITtscEvidenceBenchmarkReportInspection {
  /** Inspection attempts made, decided or not, including retries. */
  attempts: number;

  /** Attempts that produced no decision. Spent tokens still count. */
  failures: number;

  tokenUsage: ITtscEvidenceBenchmarkTokenUsage;
  elapsedMs: number;
}

/** One externally retained Plain review decision and recovery transition. */
export interface ITtscEvidenceBenchmarkReportReviewVerdict {
  scope: "backend" | "frontend" | "overall";
  attempt: number;
  decision: "pass" | "fail";
  action: "final" | "retry" | "quality-failed";
  goalIndex: number;
  terminalTurnId: string;
  rationale: string;
  feedback?: string;
  pausedAt: string;
  decidedAt: string;
  resumedAt?: string;
  verdictRelativePath: string;
  verdictSha256: string;
  workspaceMaterialSha256: string;
}

/** Publishable suspension interval with its exact excluded duration. */
export interface ITtscEvidenceBenchmarkReportSuspension extends ITtscEvidenceBenchmarkSuspension {
  elapsedMs: number;
}

/** Read-only Git delta from the prepared workspace baseline. */
export interface ITtscEvidenceBenchmarkReportWorktree {
  files: number;
  additions: number;
  deletions: number;
}

/** Retained token and work-time share attributed to one instruction. */
export interface ITtscEvidenceBenchmarkReportStage {
  name: string;
  tokens: number;
  elapsedMs: number;
  tokenPercent: number;
  timePercent: number;
}
