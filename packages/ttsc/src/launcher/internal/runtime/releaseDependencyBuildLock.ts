import type { DependencyBuildLockLease } from "./DependencyBuildLockLease";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";

/**
 * Retire a held generation during the holder's `finally`. Returns false when
 * the lease was already retired or no longer holds current.
 *
 * @evidence contracts/common.md#principled-implementation The acquired lease supplies the exact retirement generation, so a late finalizer cannot release a successor after recovery.
 * @evidence contracts/common.md#clear-and-simple-design The holder adapter uses the same fenced retirement owner as reclaim while accepting the distinct acquisition token.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Release preserves the generation fence instead of deleting whichever directory occupies the shared current name.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies finally ownership and explains false after retirement or replacement.
 * @evidence contracts/portability.md#os-neutral-implementation Native lock-path representation and platform rename semantics stay with the shared protocol implementation.
 * @evidence contracts/performance.md#efficient-algorithms The field projection delegates one retirement without a history scan; actual generation/path text, native mkdir/rename/sibling probes and peer-handle retry/yield work remain part of this call's cost and can grow with contention.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Release is a generation-specific ownership effect rather than a reusable computation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Successful retirement moves current into its retained tombstone; false and native failures do not certify release. Peer-handle waiting has no separate deadline and probe-cleanup failures can retain artifacts; container cleanup owns historical state.
 */
export function releaseDependencyBuildLock(
  lockDir: string,
  lease: DependencyBuildLockLease,
): boolean {
  return DependencyBuildLockProtocol.retireDependencyBuildLock(
    lockDir,
    lease.generation,
  );
}
