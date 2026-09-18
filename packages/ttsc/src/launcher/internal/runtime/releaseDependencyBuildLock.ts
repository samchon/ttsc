import type { DependencyBuildLockLease } from "./DependencyBuildLockLease";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";

/** Retire a held generation during the holder's `finally`. */
export function releaseDependencyBuildLock(
  lockDir: string,
  lease: DependencyBuildLockLease,
): boolean {
  return DependencyBuildLockProtocol.retireDependencyBuildLock(
    lockDir,
    lease.generation,
  );
}
