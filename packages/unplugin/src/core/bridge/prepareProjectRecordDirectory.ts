import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";
import { fallbackRecordStorage } from "./fallbackRecordStorage";
import { isGeneratedFallbackToolDirectory } from "./fallbackToolDirectory";
import { hostToolDirectory } from "./hostToolDirectory";

/**
 * Create the record directory under the current physical installation.
 * Automatic cache components are checked one at a time before descending into
 * them. Explicit record owners and the same-volume fallback supply an already
 * selected parent. The result is the spelling the publisher writes through.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath and lstat keep every automatic cache component under an ordinary physical node_modules installation before the record writer accesses it.
 * @evidence contracts/common.md#clear-and-simple-design One owner handles the default cache policy for both directory preparation and record publication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An alias at a default cache child refuses writes before recursion can reach its destination.
 * @evidence contracts/common.md#meaningful-documentation The prose explains physical placement, explicit ownership and the returned address.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs and path primitives check directory kinds and preserve the root volume and native spelling.
 * @evidence contracts/performance.md#efficient-algorithms The default layout performs a bounded sequence of direct child checks. Explicit paths retain their recursive parent creation cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each preparation observes current filesystem topology.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Created directories belong to the persistent record protocol. No additional scratch or open handle survives preparation.
 */
export function prepareProjectRecordDirectory(directory: string): string {
  if (isGeneratedFallbackToolDirectory(path.dirname(directory))) {
    if (fallbackRecordStorage(directory, true) === true) return directory;
    throw new Error(
      `@ttsc/unplugin: unsafe private project record directory: ${directory}`,
    );
  }
  const tool = path.dirname(directory);
  const workspace = path.resolve(tool, "../../../..");
  if (
    path.basename(directory) !== PROJECT_RECORD_DIRECTORY ||
    path.resolve(tool) !== hostToolDirectory(workspace)
  ) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    return directory;
  }
  const root = fs.realpathSync.native(workspace);
  const lexicalModules = path.join(root, "node_modules");
  if (fs.lstatSync(lexicalModules, { throwIfNoEntry: false }) === undefined) {
    try {
      fs.mkdirSync(lexicalModules);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  let physical = fs.realpathSync.native(lexicalModules);
  if (
    path.basename(physical) !== "node_modules" ||
    !fs.lstatSync(physical).isDirectory()
  )
    throw new Error(
      `@ttsc/unplugin: unsafe record installation: ${lexicalModules}`,
    );
  for (const name of [".cache", "ttsc", "unplugin", PROJECT_RECORD_DIRECTORY]) {
    physical = path.join(physical, name);
    let entry = fs.lstatSync(physical, { throwIfNoEntry: false });
    if (entry === undefined) {
      try {
        fs.mkdirSync(physical);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      entry = fs.lstatSync(physical);
    }
    if (!entry.isDirectory())
      throw new Error(
        `@ttsc/unplugin: unsafe project record directory: ${physical}`,
      );
  }
  return physical;
}
