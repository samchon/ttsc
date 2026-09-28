import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./runtime/ProcessOwnedDirectory";
import { withRuntimeDirectoryLock } from "./runtime/withRuntimeDirectoryLock";

/**
 * Claim a ttsx run before another preload or the program can use its output.
 *
 * The launcher can be killed after it starts a child. The child must publish
 * its own owner record under the lock that default clean uses, so either clean
 * sees its live claim or the child fails before user code if clean removed the
 * run first. NODE_OPTIONS passes this preload to descendants as well.
 */
const directory = process.env.TTSX_RUNTIME_RUN_DIR;
if (directory !== undefined) {
  if (
    !path.isAbsolute(directory) ||
    path.basename(path.dirname(directory)) !==
      SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME
  ) {
    throw new Error(`ttsx: invalid runtime run directory: ${directory}`);
  }
  const runtime = path.dirname(path.dirname(directory));
  withRuntimeDirectoryLock(runtime, () => {
    const entry = fs.lstatSync(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`ttsx: unsafe runtime run directory: ${directory}`);
    }
    ProcessOwnedDirectory.admit(directory, process.pid);
  });
}
