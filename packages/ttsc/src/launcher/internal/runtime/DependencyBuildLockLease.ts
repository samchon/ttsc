/**
 * Ownership token returned only to the process that acquired the lock.
 *
 * Produced by {@link acquireDependencyBuildLock} and consumed by
 * {@link releaseDependencyBuildLock}. Release retires this generation and no
 * other, so a holder whose lock was reclaimed cannot release its successor.
 *
 * @evidence contracts/common.md#principled-implementation A lease carries the successfully acquired generation, binding finalization to that holder even if a recovery path later publishes a successor.
 * @evidence contracts/common.md#clear-and-simple-design The single generation token separates acquisition authority from diagnostic observations and is sufficient for fenced release.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Release uses the acquired identity rather than clearing a shared path or assuming the current holder is still the caller.
 * @evidence contracts/common.md#meaningful-documentation Native prose states producer, consumer and late-finalizer safety; the member explains its 128-bit representation without a property acknowledgment.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type DependencyBuildLockLease = {
  /** The 128-bit hex id of the generation this process holds. */
  generation: string;
};
