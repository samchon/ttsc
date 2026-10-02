/**
 * Per-call controls for a resident transform or update request. Aborting
 * observation does not promise rollback of work already sent.
 *
 * @evidence contracts/common.md#principled-implementation An optional AbortSignal represents caller cancellation independently of the resident session and its already-started effects.
 * @evidence contracts/common.md#clear-and-simple-design One per-call control leaves process ownership and request contents with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation uses the standard signal protocol without replacing resident methods or introducing a fixture-specific control.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes the cancellation scope and lack of transactional rollback rather than repeating the member type.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface TtscServiceRequestOptions {
  /** Abort this call before it receives a reply. */
  signal?: AbortSignal;
}
