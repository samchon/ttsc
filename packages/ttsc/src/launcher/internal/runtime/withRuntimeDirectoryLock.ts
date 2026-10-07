import path from "node:path";

import { resolvePhysicalPath } from "../../../internal/pathIdentity/resolvePhysicalPath";
import { runHoldingLock } from "../../../internal/runHoldingLock";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { acquireDependencyBuildLock } from "./acquireDependencyBuildLock";
import { inspectDependencyBuildLock } from "./inspectDependencyBuildLock";
import { reclaimDependencyBuildLock } from "./reclaimDependencyBuildLock";
import { releaseDependencyBuildLock } from "./releaseDependencyBuildLock";

/**
 * Serialize a runtime-directory claim with `ttsc clean` over the same root.
 *
 * The existing fenced directory-lock protocol publishes a complete owner record
 * before acquisition and retires exactly the generation it held. Its lock lives
 * beside the runtime root, so clean can remove the root without removing the
 * coordination point. The shared inspector selects active/abandoned states:
 * valid owner records use conservative host/pid probes; a readable generation
 * lacking a valid owner can also become abandoned under its stale-age policy.
 * That latter policy is not a native certificate that a process died.
 * Acquisition waits use the dependency-build elapsed-time policy rather than a
 * hard completion bound on native IO, work or retirement.
 *
 * Retirement may separately wait for peer filesystem handles; that release path
 * has no independent deadline. Participants must use the same stable physical
 * namespace and valid records. A physical spelling is not a held directory
 * handle. Native acquisition or cleanup failure can leave persisted
 * candidate/current state; this wrapper does not roll back a failed acquisition
 * before it returns a lease.
 *
 * @param runtimeRoot The runtime directory, in any filesystem spelling.
 * @param work A synchronous claim or clean operation under the lock.
 * @returns What `work` returned.
 * @evidence contracts/common.md#principled-implementation Resolving the observed physical root selects the cooperative sibling lock; work executes only after a returned lease. Inspector-authorized recovery retires its observed generation, including its owner-missing stale-age policy, without claiming every abandonment decision proves native process death.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous wrapper coordinates root identity, bounded acquisition polling and finally release while delegating the fenced protocol and work/error precedence to shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper follows the actual inspector state and generation fence rather than bypassing a recognized active owner. Missing valid ownership follows the shared stale-age policy; work errors retain precedence through runHoldingLock.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the sibling coordination point, acquisition timeout and unbounded peer-handle retirement; parameters identify native root spelling and synchronous work ownership.
 * @evidence contracts/portability.md#os-neutral-implementation The shared filesystem identity resolver selects the native physical root and path constructs its sibling lock; retirement isolates platform rename/handle behavior without assuming case policy from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms Identity/path text and native observations precede polling. Attempts add candidate/generation/hostname record bytes, filesystem IO and inspector probes; contention waits use Atomics.wait and each attempt avoids retired-history scans. Work is caller-defined and retirement can wait independently; the wall-clock acquisition check does not bound blocking native calls or work.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Distinct claim and clean effects must serialize but cannot share a completed work result; each caller supplies its own synchronous effect.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One sleeper and a returned lease belong to the invocation; finally attempts retirement, with no independent peer-handle release deadline. Acquisition failures can leave persisted state before lease transfer. The sibling lock retains candidates/tombstones until appropriate recovery or container removal, with no historical quota here.
 */
export function withRuntimeDirectoryLock<T>(
  runtimeRoot: string,
  work: () => T,
): T {
  const lockDir = `${resolvePhysicalPath(path.resolve(runtimeRoot))}.lock`;
  const startedAt = Date.now();
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    const lease = acquireDependencyBuildLock(lockDir);
    if (lease !== null) {
      return runHoldingLock(
        work,
        () => {
          if (!releaseDependencyBuildLock(lockDir, lease)) {
            throw new Error(
              `runtime directory lock was not released: ${lockDir}`,
            );
          }
        },
        (error) => {
          process.emitWarning(
            `runtime directory lock release failed at ${lockDir}: ${error instanceof Error ? error.message : String(error)}`,
            { code: "TTSC_RUNTIME_DIRECTORY_LOCK_RELEASE" },
          );
        },
      );
    }
    const now = Date.now();
    const observed = inspectDependencyBuildLock(lockDir, now);
    if (observed.state === "abandoned") {
      reclaimDependencyBuildLock(lockDir, observed.fence);
    }
    if (
      Date.now() - startedAt >=
      DependencyBuildLockProtocol.DEP_BUILD_LOCK_WAIT_MS
    ) {
      throw new Error(
        `runtime directory lock did not become available at ${lockDir}: ${observed.state === "active" ? observed.owner : "no holder could be observed"}`,
      );
    }
    Atomics.wait(
      sleeper,
      0,
      0,
      DependencyBuildLockProtocol.DEP_BUILD_LOCK_POLL_MS,
    );
  }
}
