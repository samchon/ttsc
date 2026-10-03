/**
 * Common request shape for fountain verbs that act on an existing snapshot.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The opaque string matches the native snapshot registry's public identity
 *   and is shared by query types through interface extension.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The shared request contains only registry identity; derived requests add
 *   selectors without exposing the retained Program or duplicating its lifecycle.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Callers pass the returned identity; they need not reconstruct an internal
 *   sequence or depend on the current handle spelling.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the shared request role and opaque producer, following the
 *   documentation skill's requirement for nonobvious usage context.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSnapshotHandle is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSnapshotHandle is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSnapshotHandle is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscSnapshotHandle {
  /** Opaque handle returned by `snapshot`. */
  handle: string;
}
