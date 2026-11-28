import fs from "node:fs";
import path from "node:path";

import { resolvePhysicalPath } from "../../../internal/pathIdentity/resolvePhysicalPath";
import { runHoldingLock } from "../../../internal/runHoldingLock";
import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
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
 * @param systemProjectRoots Consumer boundaries when the root is managed system
 *   storage. The actual sibling lock and its mutation paths are requalified
 *   before acquisition, reclamation and release.
 * @returns What `work` returned.
 * @evidence contracts/common.md#principled-implementation Resolving the observed physical root selects the cooperative sibling lock; managed callers qualify that root and the exact lock, current and retired paths before each lock mutation. Work executes only after a returned lease. Inspector-authorized recovery retires its observed generation without claiming every abandonment decision proves native process death.
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
  systemProjectRoots?: readonly string[],
): T {
  const physicalRoot = resolvePhysicalPath(path.resolve(runtimeRoot));
  const lockDir = `${physicalRoot}.lock`;
  const requireSystemLock = () => {
    if (systemProjectRoots === undefined) return;
    if (
      runtimeRoot !== physicalRoot ||
      !fs.lstatSync(runtimeRoot).isDirectory() ||
      RuntimeFilesystem.realpathWitness(runtimeRoot) !== physicalRoot ||
      !systemTempOutsideProject.allowsChild(runtimeRoot, systemProjectRoots)
    )
      throw new Error(
        `ttsx: unsafe system runtime cache directory: ${runtimeRoot}`,
      );
    for (const candidate of [
      lockDir,
      path.join(
        lockDir,
        DependencyBuildLockProtocol.DEP_BUILD_LOCK_CURRENT_DIR,
      ),
      path.join(
        lockDir,
        DependencyBuildLockProtocol.DEP_BUILD_LOCK_RETIRED_DIR,
      ),
    ]) {
      const entry = fs.lstatSync(candidate, { throwIfNoEntry: false });
      if (
        !systemTempOutsideProject.allowsChild(candidate, systemProjectRoots) ||
        (entry !== undefined &&
          (!entry.isDirectory() ||
            RuntimeFilesystem.realpathWitness(candidate) !== candidate))
      )
        throw new Error(`ttsx: unsafe system runtime lock: ${candidate}`);
    }
  };
  const startedAt = Date.now();
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    requireSystemLock();
    const lease = acquireDependencyBuildLock(lockDir);
    if (lease !== null) {
      return runHoldingLock(
        work,
        () => {
          requireSystemLock();
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
      requireSystemLock();
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
