import type { ITtscEvidenceBenchmarkTokenUsage } from "./ITtscEvidenceBenchmarkTokenUsage";

/**
 * Retained Codex state for one prescribed benchmark objective.
 *
 * The record binds exact instruction bytes to the native Goal, terminal turn,
 * idle checkpoint, token delta, and elapsed time needed for exact recovery.
 */
export interface ITtscEvidenceBenchmarkGoalRecord {
  /** Canonical zero-based position in the arm-owned objective sequence. */
  index: number;

  /** Stable objective name used in reports. */
  name: string;

  /** Instruction path relative to the instruction root. */
  relativePath: string;

  /** Exact selected instruction bytes decoded as UTF-8. */
  prescribedText: string;

  /** Exact shared continuation instruction. */
  continuationText: string;

  /** Exact user objective sent to the native Goal API. */
  objectiveText: string;

  /** Latest native Goal snapshot. */
  goal: Record<string, unknown> | null;

  /** Terminal native turn associated with this Goal. */
  terminalTurnId: string | null;

  /** Whether the terminal turn emitted completion. */
  terminalTurnCompleted: boolean;

  /**
   * Whether that completion was read from the thread instead of observed.
   *
   * `terminalTurnCompleted` is written from one `turn/completed` notification,
   * so a process killed between the turn ending and that line arriving loses
   * the witness permanently and the Goal can never be resumed past — even
   * though the thread itself still records the turn as completed. A resume may
   * take the fact from there, and sets this so the record says which of the two
   * it was.
   */
  terminalTurnCompletionReadFromThread?: boolean;

  /** Whether the thread returned to idle after the terminal turn. */
  threadIdle: boolean;

  /** Turn whose token notification sealed the measurement. */
  tokenUsageTurnId: string | null;

  /** Thread token counters before this Goal. */
  tokenUsageStart: ITtscEvidenceBenchmarkTokenUsage;

  /** Thread token counters after this Goal. */
  tokenUsageEnd: ITtscEvidenceBenchmarkTokenUsage | null;

  /** Nonnegative token delta attributed to this Goal. */
  tokenUsage: ITtscEvidenceBenchmarkTokenUsage;

  /** Delta of the native Goal's cumulative active time. */
  elapsedMs: number;
}
