/**
 * Per-call controls for a native graph refresh.
 *
 * @evidence contracts/common.md#principled-implementation An optional AbortSignal represents caller cancellation independently of shared project identity.
 * @evidence contracts/common.md#clear-and-simple-design One field carries the only per-request lifecycle control without duplicating constructor options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation is a supported caller signal rather than an idle reset or hidden timeout.
 * @evidence contracts/common.md#meaningful-documentation The member comment explains that cancellation also retires the native session.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphRequestOptions declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphRequestOptions declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphRequestOptions declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscGraphRequestOptions declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface TtscGraphRequestOptions {
  /** Cancel this refresh and retire its native session. */
  signal?: AbortSignal;
}
