/**
 * Runs a synchronous fixture operation and releases its owned project.
 *
 * Cleanup runs even when the operation throws. A single failure is rethrown
 * unchanged, including undefined; both operation and release failures
 * remain individually observable in their original order.
 *
 * Both callbacks must finish synchronously. Their inferred return types reject
 * promises and unions containing a promise; erased types or explicit casts
 * cannot establish completion, and this owner does not await asynchronous work.
 *
 * @evidence contracts/common.md#principled-implementation The failure array records whether each operation threw independently of its thrown value; finally always invokes the explicit cleanup owner, and the result is returned only when neither operation failed. Inferred callback return types reject PromiseLike constituents so typed asynchronous work cannot release the fixture before completion; erased or cast return types remain outside that premise.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous operation owns result propagation and release ordering for ordinary Evidence consumers; callers supply their existing project and unchanged assertion callback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit operation and cleanup inputs retain actual consumer behavior without replacing foreign methods, swallowing release failures or fabricating a passing result.
 * @evidence contracts/common.md#meaningful-documentation The declaration explains synchronous ownership, unconditional release and preservation of both ordinary and undefined thrown values.
 * @evidence contracts/performance.md#efficient-algorithms The owner invokes each callback once and retains at most two failures, using constant bookkeeping independently of fixture size.
 * @evidence contracts/performance.md#reuse-equivalent-work All ordinary callers share one release policy; the operation's result is invocation-local and is not reused across changed consumer inputs.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller-provided project is released in finally; the result and at most two errors survive only for this call's return or throw, and release exhaustion remains observable.
 */
export function withEvidenceProject<Result, Release>(
  project: {
    cleanup: (() => Release) &
      (Extract<Release, PromiseLike<unknown>> extends never ? unknown : never);
  },
  operation: (() => Result) &
    (Extract<Result, PromiseLike<unknown>> extends never ? unknown : never),
): Result {
  let result!: Result;
  const failures: unknown[] = [];
  try {
    result = operation();
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      project.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Evidence operation and cleanup failed.");
  return result;
}
