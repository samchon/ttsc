import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Requalify a direct run below the system cache index before writing to it. An
 * absent run can be claimed, while an existing run must keep its ordinary
 * physical spelling and remain outside current project boundaries.
 *
 * @evidence contracts/common.md#principled-implementation The ordinary index and run use exact native identities. Project markers and selected roots are checked at the run, where ownership can change after cache selection.
 * @evidence contracts/common.md#clear-and-simple-design System callers share one optional mutation guard across claim and cleanup. Explicit cache callers retain their own policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A former owner record cannot authorize an alias, a project tree or an unobservable run.
 * @evidence contracts/common.md#meaningful-documentation Describes current qualification and the absent-run claim case.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat and lossless realpath distinguish ordinary POSIX and Windows directories from links and junctions.
 * @evidence contracts/performance.md#efficient-algorithms Fixed native identity probes and delegated project ancestry checks require no recursive listing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A later mutation needs current evidence.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate writes nothing and acquires no handle.
 */
export function systemRuntimeRunCanChange(
  directory: string,
  runtimeRoot: string,
  projectRoots: readonly string[],
): boolean {
  const index = path.join(
    runtimeRoot,
    SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME,
  );
  if (path.dirname(directory) !== index) return false;
  try {
    if (
      !fs.lstatSync(runtimeRoot).isDirectory() ||
      RuntimeFilesystem.realpathWitness(runtimeRoot) !== runtimeRoot ||
      !systemTempOutsideProject.allowsChild(directory, projectRoots)
    )
      return false;
    const indexEntry = fs.lstatSync(index, { throwIfNoEntry: false });
    if (
      indexEntry !== undefined &&
      (!indexEntry.isDirectory() ||
        RuntimeFilesystem.realpathWitness(index) !== index)
    )
      return false;
    const entry = fs.lstatSync(directory, { throwIfNoEntry: false });
    return (
      entry === undefined ||
      (entry.isDirectory() &&
        RuntimeFilesystem.realpathWitness(directory) === directory)
    );
  } catch {
    return false;
  }
}
