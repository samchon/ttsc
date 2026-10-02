/**
 * Payload inside `ITtscResult.result` for `snapshots`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A string array mirrors the registry listing without exposing program objects
 *   or implying an ordering that the native map does not provide.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A flat list exposes live registry identities without a second snapshot
 *   descriptor layer or ownership information already supplied by its API.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Entries are current registry identities rather than an expected debug list.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the envelope, empty state and unspecified order using the
 *   documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSnapshotsResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSnapshotsResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSnapshotsResult is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscSnapshotsResult is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscSnapshotsResult {
  /** Live handles in unspecified order; empty when none are registered. */
  handles: string[];
}
