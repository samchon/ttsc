import fs from "node:fs";
import path from "node:path";

import { prunesPluginSourceDirectory } from "./prunesPluginSourceDirectory";

/**
 * The directories of one plugin source directory that an observer of the source
 * watches: the directory itself and every directory below it outside those the
 * build passes over (`prunesPluginSourceDirectory`: a nested `node_modules`, a
 * repository's `.git`, ttsc's own `.ttsc`).
 *
 * A file the build reads lands in one of these, so watching each of them, the
 * way an observer that hears only a directory's direct entries has to, hears
 * every source edit and every new file, and nothing a package manager or Git
 * writes. `ttsc --watch` and a `ttscserver` session take the list from here
 * (samchon/ttsc#1492, samchon/ttsc#1507), so the two observe exactly the same
 * tree. A path that is not a directory has none.
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
 * @evidence contracts/common.md#meaningful-documentation Native prose states root-first results, watcher purpose and non-vanishing enumeration failure behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Node's stat/Dirent/path APIs establish native directory kinds; only ENOENT/ENOTDIR mean a vanished entry, without OS-specific case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms One pass over unpruned entries and a directory stack give O(E) traversal and O(D) returned/queued paths without recursive JavaScript call depth.
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
