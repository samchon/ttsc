/**
 * Payload inside `ITtscResult.result` for `snapshot`.
 *
 * The caller owns the returned snapshot and must release it when queries
 * finish.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Returning an opaque handle keeps retained Go program objects behind the
 *   native registry while allowing several queries to share one snapshot.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single opaque handle transfers query access to the caller; registry state
 *   and Program cleanup remain with the host instead of entering the payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The handle refers to a real registered program, without encoding a consumer
 *   path or fabricated query result into the public identity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate JSDoc paragraphs explain the envelope and release ownership, and
 *   the member names its consumers, following the documentation skill's guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSnapshotResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSnapshotResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSnapshotResult is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscSnapshotResult {
  /** Opaque handle; pass back to fountain verbs and to `releaseSnapshot`. */
  handle: string;
}
