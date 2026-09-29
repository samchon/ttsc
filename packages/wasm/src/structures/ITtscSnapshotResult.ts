/**
 * Payload inside `ITtscResult.result` for `snapshot`.
 *
 * The caller owns the returned snapshot and must release it when queries finish.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Returning an opaque handle keeps retained Go program objects behind the
 *   native registry while allowing several queries to share one snapshot.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The handle refers to a real registered program, without encoding a consumer
 *   path or fabricated query result into the public identity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate JSDoc paragraphs explain the envelope and release ownership, and
 *   the member names its consumers, following the documentation skill's guidance.
 */
export interface ITtscSnapshotResult {
  /** Opaque handle; pass back to fountain verbs and to `releaseSnapshot`. */
  handle: string;
}
