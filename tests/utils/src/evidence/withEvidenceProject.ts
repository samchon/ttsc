/**
 * Runs a synchronous fixture operation and releases its owned project.
 *
 * Cleanup runs even when the operation throws. A single failure is rethrown
 * unchanged, including undefined; both operation and release failures remain
 * individually observable in their original order.
 *
 * Both callbacks must finish synchronously. Their inferred return types reject
 * promises and unions containing a promise; erased types or explicit casts
 * cannot establish completion, and this owner does not await asynchronous
 * work.
 *
 * @evidence contracts/common.md#principled-implementation The failure array records whether each operation threw independently of its thrown value; finally always invokes the explicit cleanup owner, and the result is returned only when neither operation failed. Inferred callback return types reject PromiseLike constituents so typed asynchronous work cannot release the fixture before completion; erased or cast return types remain outside that premise.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous operation owns result propagation and release ordering for ordinary Evidence consumers; callers supply their existing project and unchanged assertion callback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit operation and cleanup inputs retain actual consumer behavior without replacing foreign methods, swallowing release failures or fabricating a passing result.
 * @evidence contracts/common.md#meaningful-documentation The declaration explains synchronous ownership, unconditional cleanup invocation and preservation of both ordinary and undefined thrown values; the cleanup owner may refuse unresolved-reader input removal.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Finally requests the caller-provided project's release; its cleanup owner may refuse removal after unknown process closure and that failure remains observable. The result and at most two errors survive only for this call's return or throw.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This synchronous callback owner performs no native operation itself; actual fixture removal belongs to the supplied cleanup owner.
 * @evidence contracts/performance.md#efficient-algorithms One operation and one release request run once each; at most two failures are retained and no traversal depends on fixture size.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Operations and cleanup are effectful requests and are never reused across calls.
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
    throw new AggregateError(
      failures,
      "Evidence operation and cleanup failed.",
    );
  return result;
}
