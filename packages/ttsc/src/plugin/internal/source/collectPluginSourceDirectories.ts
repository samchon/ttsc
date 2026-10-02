import fs from "node:fs";
import path from "node:path";

import { prunesPluginSourceDirectory } from "./prunesPluginSourceDirectory";

/**
 * The directories of one plugin source directory that an observer of the source
 * watches: the directory itself and every directory below it outside those the
 * build passes over (`prunesPluginSourceDirectory`: a nested `node_modules`, a
 * repository's `.git`, ttsc's own `.ttsc`).
 *
 * These are candidate directories for nonrecursive observation. Native watcher
 * acquisition, event delivery and later topology changes belong to consumers;
 * this sequential listing does not prove every edit was observed. Names pruned
 * by policy are omitted regardless of who writes them. `ttsc --watch` and the
 * `ttscserver` selection-input capture share this enumeration rule. The root
 * uses stat (and may be an alias); listed child links are not descended into.
 * A non-directory root has no results, but a queued directory can disappear
 * after being appended to the returned list.
 *
 * @param root The plugin source directory.
 *
 * @returns Absolute directories, `root` first.
 *
 * @throws When a directory cannot be read for a reason other than having
 *   vanished while it was listed.
 *
 * @evidence contracts/common.md#principled-implementation The explicit stack visits ordinary unpruned directories, including the root, giving nonrecursive watchers the directory population needed to observe source additions and edits.
 * @evidence contracts/common.md#clear-and-simple-design Iterative traversal and one vanished-entry classifier keep enumeration separate from watcher acquisition and callback ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory pruning delegates the actual source contract instead of hiding expensive or failing consumer directories behind local exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose states root-first candidates, root-alias/vanishing-entry behavior and the separate consumer ownership of watcher acquisition, topology updates and event delivery.
 * @evidence contracts/portability.md#os-neutral-implementation Node's stat/Dirent/path APIs establish native directory kinds; only ENOENT/ENOTDIR mean a vanished entry, without OS-specific case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms One traversal visits E listed entries without recursive JavaScript call depth. Processing includes root resolution/stat, native listings and name/path construction; returned/queued D paths retain their text, and one directory's Dirent array adds peak-listing space. This accounts for entry/path bytes as well as counts, without allocating watchers.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This lists current directories; the consumer owns sharing and replacing watcher populations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The listing opens no lasting watcher or handle; its caller owns resources created from the returned paths.
 */
export function collectPluginSourceDirectories(root: string): string[] {
  const directory = path.resolve(root);
  try {
    if (!fs.statSync(directory).isDirectory()) return [];
  } catch (error) {
    if (isVanishedFilesystemEntry(error)) return [];
    throw error;
  }
  const directories: string[] = [];
  const stack = [directory];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    directories.push(current);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (isVanishedFilesystemEntry(error)) continue;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !prunesPluginSourceDirectory(entry.name)) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return directories;
}

function isVanishedFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
