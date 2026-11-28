import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./runtime/ProcessOwnedDirectory";
import { systemRuntimeRunCanChange } from "./runtime/systemRuntimeRunCanChange";
import { withRuntimeDirectoryLock } from "./runtime/withRuntimeDirectoryLock";

/**
 * Claim a ttsx run before another preload or the program can use its output.
 *
 * The launcher can be killed after it starts a child. The child must publish
 * its own owner record under the lock that default clean uses, so either clean
 * sees its live claim or the child fails before user code if clean removed the
 * run first. NODE_OPTIONS passes this preload to descendants as well. A child
 * without the inherited runtime manifest uses its own cache and claims no part
 * of the parent's run.
 */
const directory = process.env.TTSX_RUNTIME_RUN_DIR;
const manifest = process.env.TTSX_RUNTIME_MANIFEST;
const runtime = process.env.TTSX_RUNTIME_CACHE_DIR;
const runs = process.env.TTSX_RUNTIME_RUNS_DIR;
if (
  directory !== undefined &&
  manifest !== undefined &&
  manifest.length !== 0
) {
  if (
    !path.isAbsolute(directory) ||
    runtime === undefined ||
    !path.isAbsolute(runtime) ||
    runs === undefined ||
    !path.isAbsolute(runs) ||
    path.dirname(directory) !== runs
  ) {
    throw new Error(`ttsx: invalid runtime run directory: ${directory}`);
  }
  const encodedRoots = process.env.TTSX_RUNTIME_SYSTEM_PROJECTS;
  let systemProjectRoots: readonly string[] | undefined;
  let canChange: ((candidate: string) => boolean) | undefined;
  if (encodedRoots !== undefined) {
    const roots: unknown = JSON.parse(encodedRoots);
    if (
      !Array.isArray(roots) ||
      roots.length === 0 ||
      !roots.every(
        (root: unknown) => typeof root === "string" && path.isAbsolute(root),
      ) ||
      runs !==
        path.join(runtime, SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME) ||
      (manifest !== path.join(directory, "runtime-manifest.json") &&
        manifest !== path.join(directory, "prebuild-manifest.json"))
    )
      throw new Error(
        `ttsx: invalid system runtime run directory: ${directory}`,
      );
    const projectRoots = roots;
    systemProjectRoots = projectRoots;
    canChange = (candidate) =>
      systemRuntimeRunCanChange(candidate, runtime, projectRoots);
    if (!canChange(directory))
      throw new Error(`ttsx: unsafe runtime run directory: ${directory}`);
  }
  const claim = () => {
    if (canChange !== undefined) {
      if (!canChange(directory))
        throw new Error(`ttsx: unsafe runtime run directory: ${directory}`);
      const manifestEntry = fs.lstatSync(manifest);
      if (!manifestEntry.isFile() || manifestEntry.nlink !== 1)
        throw new Error(`ttsx: unsafe system runtime manifest: ${manifest}`);
    }
    const entry = fs.lstatSync(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`ttsx: unsafe runtime run directory: ${directory}`);
    }
    ProcessOwnedDirectory.admit(directory, process.pid, canChange);
  };
  withRuntimeDirectoryLock(runtime, claim, systemProjectRoots);
}
