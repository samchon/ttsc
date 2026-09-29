/**
 * Per-call controls for a resident transform or update request. Aborting
 * observation does not promise rollback of work already sent.
 *
 * @evidence contracts/common.md#principled-implementation An optional AbortSignal represents caller cancellation independently of the resident session and its already-started effects.
 * @evidence contracts/common.md#clear-and-simple-design One per-call control leaves process ownership and request contents with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation uses the standard signal protocol without replacing resident methods or introducing a fixture-specific control.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes the cancellation scope and lack of transactional rollback rather than repeating the member type.
 */
export interface TtscServiceRequestOptions {
  /** Abort this call before it receives a reply. */
  signal?: AbortSignal;
}
