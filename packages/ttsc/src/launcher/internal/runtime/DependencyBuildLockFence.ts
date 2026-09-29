/**
 * Opaque identity of one observed lock generation.
 *
 * Returned by {@link inspectDependencyBuildLock} and consumed by
 * {@link reclaimDependencyBuildLock}, so a waiter retires exactly the generation
 * it judged abandoned and never a successor that took the lock in the
 * meantime.
 *
 * @evidence contracts/common.md#principled-implementation The observed generation is the retirement fence, so an abandoned observation identifies one historical holder rather than authorizing removal of whatever holds current later.
 * @evidence contracts/common.md#clear-and-simple-design One generation member carries the only identity the reclaim operation needs; observation labels and ownership authority stay outside the fence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The token preserves generation identity instead of substituting a stale timeout or pid for retirement authority.
 * @evidence contracts/common.md#meaningful-documentation Native prose connects observation and reclaim, explains successor protection and documents the unreadable-generation sentinel without field tags.
 */
export type DependencyBuildLockFence = {
  /** The 128-bit hex id of the observed generation; empty when unreadable. */
  generation: string;
};
