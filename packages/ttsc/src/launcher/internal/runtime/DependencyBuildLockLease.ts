/**
 * Ownership token returned only to the process that acquired the lock.
 *
 * Produced by {@link acquireDependencyBuildLock} and consumed by
 * {@link releaseDependencyBuildLock}. Release retires this generation and no
 * other, so a holder whose lock was reclaimed cannot release its successor.
 */
export type DependencyBuildLockLease = {
  /** The 128-bit hex id of the generation this process holds. */
  generation: string;
};
