/**
 * Acquired-generation token returned by successful lock acquisition.
 *
 * Produced by {@link acquireDependencyBuildLock} and consumed by
 * {@link releaseDependencyBuildLock}. Release retires this generation and no
 * other under a stable cooperative namespace with noncolliding generation
 * identities. A late holder therefore targets its historical generation;
 * the structural type itself does not authenticate acquisition or ownership.
 *
 * @evidence contracts/common.md#principled-implementation A lease carries the successfully acquired generation, binding finalization to that holder even if a recovery path later publishes a successor.
 * @evidence contracts/common.md#clear-and-simple-design The single generation member separates an acquisition result from diagnostic observations; release consumes that identity under the protocol's namespace and generation premises.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Release uses the acquired identity rather than clearing a shared path or assuming the current holder is still the caller.
 * @evidence contracts/common.md#meaningful-documentation Native prose states producer, consumer and conditional late-finalizer safety, distinguishing the structural value from ownership authentication; the member explains its 128-bit representation without a property acknowledgment.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation The lease carries a lowercase hexadecimal generation, not a native path or process-liveness representation. Native release resolves it within the cooperative lock namespace; this value is neither a filesystem handle nor an authenticated process identity.
 */
export type DependencyBuildLockLease = {
  /** The 128-bit hex id of the generation this process holds. */
  generation: string;
};
