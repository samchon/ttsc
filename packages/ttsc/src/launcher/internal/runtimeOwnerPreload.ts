import fs from "node:fs";
import path from "node:path";

import { ProcessOwnedDirectory } from "./runtime/ProcessOwnedDirectory";
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
  withRuntimeDirectoryLock(runtime, () => {
    const entry = fs.lstatSync(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`ttsx: unsafe runtime run directory: ${directory}`);
    }
    ProcessOwnedDirectory.admit(directory, process.pid);
  });
}
