import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";
import { withRuntimeDirectoryLock } from "./withRuntimeDirectoryLock";

/**
 * Select the runtime project index and publish one run's owner under clean's
 * cooperative root lock. The caller supplies a pinned cache-root spelling and
 * a validated run key whose replacement authority belongs to this execution.
 * The returned directory carries a record until relinquishment; the record and
 * realpath spelling are not process-incarnation or directory-handle leases.
 *
 * A supplied lock operation owns the same synchronous root transaction as the
 * default runtime-directory lock. Directory selection, abandoned-run sweeping,
 * replacement and claim publication all occur before that transaction ends.
 * Participants must preserve the selected physical namespace and share that
 * lock identity. Effects are not an atomic filesystem transaction: a failure
 * can leave created directories or a partially published record, and this
 * function does not roll them back. Caller cleanup owns those remaining effects.
 *
 * @param runtimeRoot The already-pinned physical runtime cache root.
 * @param runKey The caller's validated private run identity.
 * @param withLock The operation that serializes this root against clean.
 *
 * @evidence contracts/common.md#principled-implementation Project index selection and run-record publication occur inside the cooperative root-lock scope, excluding clean participants using the same stable identity. This does not certify rollback, physical namespace immutability or actual process incarnation.
 * @evidence contracts/common.md#clear-and-simple-design One operation owns pinning, sweep, replacement and claim; the caller owns virtual emit layout and eventual relinquishment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem operations and the default real runtime lock preserve actual ownership; supplied lock operations must serialize the same root rather than bypass coordination.
 * @evidence contracts/common.md#meaningful-documentation Native prose states validated replacement authority, cooperative lock/namespace premises, absence of rollback and transferred directory lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath selects the currently observed link/junction target before run-path construction. Shared native lock/probe owners coordinate that spelling; stable namespace and caller-owned replacement remain premises rather than handles held here.
 * @evidence contracts/performance.md#efficient-algorithms Lock acquisition/retirement delegates identity, record IO and contention waits. The index sweep pays entry/path/owner-record/native-probe costs; selected recursive replacement pays its existing tree size, and creation/publication follow path depth/text and JSON/native IO. Fixed effect count does not bound those costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Claims and replacements are distinct lifetime effects that cannot reuse a prior operation result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Finally attempts lock retirement, whose peer-handle release has no independent deadline. Successful directory ownership transfers to the caller; created/deleted/partially published effects are not rolled back on failure, and abandoned/unknown/live or native-failed leftovers have no reclamation deadline here.
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
