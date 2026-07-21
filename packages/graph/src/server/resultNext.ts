import { ITtscGraphNext } from "../structures/ITtscGraphNext";

/** A runner's result structure paired with the next-step calibration for it. */
export interface IRunnerOutput<T> {
  /** The graph result structure. */
  result: T;

  /** How to use the result next. */
  next: ITtscGraphNext;

  /**
   * Set when a caller cap removed members from the result, so the audit can
   * stop claiming the symbol's members are complete.
   */
  membersCapped?: boolean;
}

export function resultNext(
  action: ITtscGraphNext["action"],
  reason: string,
  request?: ITtscGraphNext["request"],
): ITtscGraphNext {
  return {
    action,
    reason,
    ...(request !== undefined ? { request } : {}),
  };
}
