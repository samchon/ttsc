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
 * @param runtimeRoot The runtime directory, in any filesystem spelling.
 * @param work A synchronous claim or clean operation under the lock.
 * @returns What `work` returned.
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
      continue;
    }
    if (now - startedAt >= DependencyBuildLockProtocol.DEP_BUILD_LOCK_WAIT_MS) {
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
