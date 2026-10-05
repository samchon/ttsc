/**
 * Cancellation for a resident transform or update request.
 *
 * An abort before enqueueing affects only this call. Once enqueued, an abort
 * retires the shared resident host and rejects its outstanding calls because
 * the FIFO reply protocol carries no request identifiers. Work already sent has
 * no rollback guarantee.
 *
 * @evidence contracts/common.md#principled-implementation The optional standard AbortSignal expresses caller cancellation; pre-enqueue cancellation is local, while queued cancellation retires the identifier-free FIFO so later replies cannot settle the wrong call.
 * @evidence contracts/common.md#clear-and-simple-design One per-call control leaves process ownership and request contents with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation uses the standard signal protocol without replacing resident methods or introducing a fixture-specific control.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain cancellation before and after enqueueing, the shared-host effect and absence of transactional rollback, with prose separated from tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface TtscServiceRequestOptions {
  /** Abort this call; an enqueued call also retires the shared resident host. */
  signal?: AbortSignal;
}
