/**
 * Payload inside `ITtscResult.result` for `releaseSnapshot`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The boolean mirrors the native release outcome without making an unknown
 *   handle into a transport failure; idempotent callers can inspect the result.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One outcome field conveys registry removal; handle lookup and resource
 *   cleanup belong to the native owner, outside this response value.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The actual release outcome is represented instead of always reporting success.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates the enclosing payload from absent-handle meaning, following
 *   the documentation skill's guidance for failure and optional state.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscReleaseSnapshotResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscReleaseSnapshotResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscReleaseSnapshotResult is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscReleaseSnapshotResult {
  /** `false` when the handle was absent, whether never created or already released. */
  released: boolean;
}
