import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";

/**
 * Retire exactly the generation carried by an abandoned observation. Returns
 * false when that generation is no longer the held one.
 *
 * @evidence contracts/common.md#principled-implementation Delegating the observation's generation to fenced retirement prevents a stale recovery attempt from moving a successor's current directory.
 * @evidence contracts/common.md#clear-and-simple-design This recovery adapter accepts a fence rather than acquisition authority and keeps the retirement algorithm in the shared protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No unconditional recursive deletion or timeout-only removal substitutes for generation-fenced retirement.
 * @evidence contracts/common.md#meaningful-documentation Native prose states exact-generation recovery and the false result when ownership changed.
 * @evidence contracts/portability.md#os-neutral-implementation Native rename behavior and contention handling remain in the shared retirement owner; the adapter preserves the caller's native lock path.
 * @evidence contracts/performance.md#efficient-algorithms The adapter adds constant work to one generation-retirement operation and does not scan holders or tombstones.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reclaim is an ownership-changing effect; a prior result cannot authorize another generation's recovery.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retirement transfers the held directory into its generation tombstone; historical tombstones remain necessary for stale fences until the owning lock container is removed.
 */
export function reclaimDependencyBuildLock(
  lockDir: string,
  fence: DependencyBuildLockFence,
): boolean {
  return DependencyBuildLockProtocol.retireDependencyBuildLock(
    lockDir,
    fence.generation,
  );
}
