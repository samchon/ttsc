import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Whether a build's copy of a plugin source directory takes the entry at
 * `location`, by the rule its binary is keyed on (`collectPluginSourceFiles`):
 * a directory unless the naming policy excludes it, a regular file unless its
 * name is excluded, and never a link or any other entry.
 *
 * The filter does not inspect Go embed directives. An excluded name remains
 * absent from the copy even when its original bytes are valid Go package data.
 *
 * The build verifies its copy against the key's digest of the source
 * (`pluginSourceDigest`), so the two have to read the same files. A copy that
 * judged every entry by its name alone left out a file the key read, such as
 * the `.git` file at the root of a Git worktree or submodule, and read a
 * directory the key's walk entered, such as one named like an editor backup;
 * every build of such a source then failed as edited while it was built.
 *
 * A link is never copied: the key's walk refuses one the build would read
 * before any copy, and passes over the rest.
 *
 * @param root The plugin source directory being copied, which is always taken.
 * @param location An entry at or below `root`.
 *
 * @evidence contracts/common.md#principled-implementation The root is always copied; lstat distinguishes directories from regular files so each uses the same kind-specific prune/omit policy as the digest walk, while links cannot introduce unkeyed content.
 * @evidence contracts/common.md#clear-and-simple-design One copy filter delegates shared name policy and leaves recursive materialization to fs.cpSync.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Kind-aware matching corrects the false assumption that every entry with a directory-like name is a directory, rather than adding filename exceptions.
 * @evidence contracts/common.md#meaningful-documentation The owning prose explains key/copy agreement, explicit exclusions without Go embed discovery, worktree .git files and the reason links are never copied.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and lstat preserve filesystem entry kinds without following symbolic links or Windows junctions.
 * @evidence contracts/performance.md#efficient-algorithms One lstat and fixed-policy membership checks decide each visited entry; the filter allocates no subtree listing of its own.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The copy owner shares the resulting snapshot; this per-entry policy predicate stores no computed result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate acquires no lasting handle and retains no state after returning.
 */
export function copiesPluginSourceEntry(
  root: string,
  location: string,
): boolean {
  if (path.resolve(location) === path.resolve(root)) return true;
  let info: fs.Stats;
  try {
    info = fs.lstatSync(location);
  } catch {
    return false;
  }
  const name = path.basename(location);
  if (info.isDirectory()) return !GoSourceInputs.shouldPruneDirectory(name);
  return info.isFile() && !GoSourceInputs.shouldOmitSourceFile(name);
}
