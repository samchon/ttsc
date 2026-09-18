/**
 * Opaque identity of one observed lock generation.
 *
 * Returned by {@link inspectDependencyBuildLock} and consumed by
 * {@link reclaimDependencyBuildLock}, so a waiter retires exactly the generation
 * it judged abandoned and never a successor that took the lock in the meantime.
 */
export type DependencyBuildLockFence = {
  /** The 128-bit hex id of the observed generation; empty when unreadable. */
  generation: string;
};
