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
 * @returns Absolute directories, `root` first.
 * @throws When a directory cannot be read for a reason other than having
 *   vanished while it was listed.
 */
export function collectPluginSourceDirectories(root: string): string[] {
  try {
    if (!fs.statSync(root).isDirectory()) return [];
  } catch {
    return [];
  }
  const directories: string[] = [];
  const stack = [root];
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
