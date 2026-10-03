import { ITtscGraphNext } from "../structures/ITtscGraphNext";

/**
 * A runner's result structure paired with the next-step calibration for it.
 *
 * @evidence contracts/common.md#principled-implementation The generic result remains its operation's typed shape while next and optional member truncation qualify how it may be used.
 * @evidence contracts/common.md#clear-and-simple-design Shared control metadata wraps runner-specific facts without copying all result unions here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Member caps are explicit so audits cannot silently claim completeness after omission.
 * @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain next guidance and the capped-member audit consequence.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
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

/**
 * Construct a next decision, omitting the request field when none is supplied.
 *
 * Callers own the justification for action and any inspect request.
 *
 * @evidence contracts/common.md#principled-implementation Typed action/request values retain the supported decision vocabulary and optional-field semantics.
 * @evidence contracts/common.md#clear-and-simple-design One constructor centralizes omission of absent request metadata without owning runner policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The helper does not infer question intent or add a forced follow-up operation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states caller policy ownership and conditional field omission.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources returns a plain object and retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms builds one small object.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work pure constructor, nothing to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation builds a plain object; no file, path or process.
 */
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
