/**
 * Opaque identity of one observed lock generation.
 *
 * Returned by {@link inspectDependencyBuildLock} and consumed by
 * {@link reclaimDependencyBuildLock}, so a waiter retires exactly the generation
 * it judged abandoned. Successor protection relies on the protocol's stable
 * cooperative namespace and noncolliding generation identities; this
 * structural value is not an authenticated ownership credential.
 *
 * @evidence contracts/common.md#principled-implementation The observed generation is the retirement fence, so an abandoned observation identifies one historical holder rather than authorizing removal of whatever holds current later.
 * @evidence contracts/common.md#clear-and-simple-design One generation member carries the only identity the reclaim operation needs; observation labels and ownership authority stay outside the fence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The token preserves generation identity instead of substituting a stale timeout or pid for retirement authority.
 * @evidence contracts/common.md#meaningful-documentation Native prose connects observation and reclaim, states the namespace and generation premises and documents the unreadable-generation sentinel without field tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation The fence carries a lowercase hexadecimal generation or an empty unreadable sentinel, not a native path, pid or filesystem capability. The native retirement consumer applies this identity in its cooperative lock namespace; the string alone neither pins that namespace nor authenticates a holder.
 */
export type DependencyBuildLockFence = {
  /** The 128-bit hex id of the observed generation; empty when unreadable. */
  generation: string;
};
