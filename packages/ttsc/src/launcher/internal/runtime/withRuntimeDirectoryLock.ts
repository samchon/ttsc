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
 * coordination point. A dead holder is reclaimed; a live one is waited on with
 * the same bounded wait as dependency builds.
 *
 * Retirement may separately wait for peer filesystem handles; that release path
 * has no independent deadline.
 *
 * @param runtimeRoot The runtime directory, in any filesystem spelling.
 * @param work A synchronous claim or clean operation under the lock.
 *
 * @returns What `work` returned.
 *
 * @evidence contracts/common.md#principled-implementation Resolving one physical root selects a shared sibling lock; claim and clean execute only under an acquired generation, and dead-owner recovery retires the observed fence rather than a successor.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous wrapper coordinates root identity, bounded acquisition polling and finally release while delegating the fenced protocol and work/error precedence to shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambiguous live ownership is waited on rather than bypassed; work errors survive finalization through runHoldingLock instead of being replaced by cleanup errors.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the sibling coordination point, acquisition timeout and unbounded peer-handle retirement; parameters identify native root spelling and synchronous work ownership.
 * @evidence contracts/portability.md#os-neutral-implementation The shared filesystem identity resolver selects the native physical root and path constructs its sibling lock; retirement isolates platform rename/handle behavior without assuming case policy from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms Fixed-record lock polling sleeps through Atomics.wait instead of busy-spinning; attempts grow with contention duration and each attempt avoids scanning retired history.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Distinct claim and clean effects must serialize but cannot share a completed work result; each caller supplies its own synchronous effect.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One lease and sleeper belong to an invocation and finally retires the lease; the sibling lock retains generation tombstones until its owner removes the container, with no historical quota or independent peer-handle release deadline.
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
