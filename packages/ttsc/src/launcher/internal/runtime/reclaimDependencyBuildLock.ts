import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";

/**
 * Retire exactly the generation carried by an abandoned observation. Exported
 * for the deterministic multi-process cache regressions.
 */
export function reclaimDependencyBuildLock(
  lockDir: string,
  fence: DependencyBuildLockFence,
): boolean {
  return DependencyBuildLockProtocol.retireDependencyBuildLock(lockDir, fence.generation);
}
