import fs from "node:fs";
import path from "node:path";

import { RuntimeTrash } from "../../../internal/RuntimeTrash";
import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Requalify runtime runs, build storage and trash before mutation. Existing
 * directories must keep their ordinary physical spelling and remain outside
 * current project boundaries.
 *
 * @evidence contracts/common.md#principled-implementation The ordinary index and run use exact native identities. Project markers and selected roots are checked at the run, where ownership can change after cache selection.
 * @evidence contracts/common.md#clear-and-simple-design System callers share one optional mutation guard across claim and cleanup. Explicit cache callers retain their own policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A former owner record cannot authorize an alias, a project tree or an unobservable run.
 * @evidence contracts/common.md#meaningful-documentation Describes current qualification and the absent-run claim case.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat and lossless realpath distinguish ordinary POSIX and Windows directories from links and junctions.
 * @evidence contracts/performance.md#efficient-algorithms Native probes and project ancestry checks examine only the nominated path and its ancestors.
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
  const relative = path.relative(runtimeRoot, directory);
  if (path.join(runtimeRoot, relative) !== directory) return false;
  const [first, second, ...rest] = relative.split(path.sep);
  const inStore =
    first === SourceBuildCacheLayout.RUNTIME_BUILD_CACHE_DIRNAME &&
    (second === undefined ||
      second === RuntimeTrash.DIRNAME ||
      /^[0-9a-f]{64}\.(?:pending|environment)$/.test(second));
  if (
    first !== RuntimeTrash.DIRNAME &&
    !inStore &&
    !(
      first === path.basename(index) &&
      second !== undefined &&
      (rest.length === 0 ||
        rest[0] === "fs" ||
        rest[0] === "deps" ||
        rest[0] === "parks")
    )
  )
    return false;
  try {
    if (
      !fs.lstatSync(runtimeRoot).isDirectory() ||
      RuntimeFilesystem.realpathWitness(runtimeRoot) !== runtimeRoot ||
      !systemTempOutsideProject.allowsChild(directory, projectRoots)
    )
      return false;
    for (
      let current = directory;
      current !== runtimeRoot;
      current = path.dirname(current)
    ) {
      const entry = fs.lstatSync(current, { throwIfNoEntry: false });
      if (
        entry !== undefined &&
        (!entry.isDirectory() ||
          RuntimeFilesystem.realpathWitness(current) !== current)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
