import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";
import { withRuntimeDirectoryLock } from "./withRuntimeDirectoryLock";

/**
 * Pin the runtime project index and publish one run's owner atomically with
 * clean. The caller already pinned the cache root and validated its run key.
 * The returned physical directory remains claimed until its execution owner
 * relinquishes it, including preparation failure cleanup.
 *
 * A supplied lock operation owns the same synchronous root transaction as the
 * default runtime-directory lock. Directory selection, abandoned-run sweeping,
 * replacement and claim publication all occur before that transaction ends.
 *
 * @param runtimeRoot The already-pinned physical runtime cache root.
 * @param runKey The caller's validated private run identity.
 * @param withLock The operation that serializes this root against clean.
 *
 * @evidence contracts/common.md#principled-implementation The physical project index and live run owner publish inside one root-lock transaction, so clean cannot observe a selected but unclaimed index.
 * @evidence contracts/common.md#clear-and-simple-design One operation owns pinning, sweep, replacement and claim; the caller owns virtual emit layout and eventual relinquishment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem operations and the default real runtime lock preserve actual ownership; supplied lock operations must serialize the same root rather than bypass coordination.
 * @evidence contracts/common.md#meaningful-documentation Native prose states validated inputs, atomic effects, lock responsibility and transferred directory lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath pins links or junctions before run paths are selected, and the shared sweep and lock owners preserve native identity and process liveness.
 * @evidence contracts/performance.md#efficient-algorithms One transaction scans the current index through the existing sweep owner, then performs constant-count creation, replacement and publication effects.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Claims and replacements are distinct lifetime effects that cannot reuse a prior operation result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The lock owner releases its lease on return or failure; a successful process-owned directory transfers to the caller for relinquishment and cleanup.
 */
export function claimRuntimeProjectDirectory(
  runtimeRoot: string,
  runKey: string,
  withLock: typeof withRuntimeDirectoryLock = withRuntimeDirectoryLock,
): string {
  return withLock(runtimeRoot, () => {
    const directory = path.join(runtimeRoot, SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME);
    fs.mkdirSync(directory, { recursive: true });
    const runsDir = fs.realpathSync.native(directory);
    const processDir = path.join(runsDir, runKey);
    ProcessOwnedDirectory.sweep(runsDir);
    fs.rmSync(processDir, { recursive: true, force: true });
    ProcessOwnedDirectory.claim(processDir);
    return processDir;
  });
}
