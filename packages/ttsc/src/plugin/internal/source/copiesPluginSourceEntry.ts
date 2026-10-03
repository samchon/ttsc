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
 * judged every entry by its name alone would leave out a file the key reads,
 * such as the `.git` file at the root of a Git worktree or submodule, and read
 * a directory the key's walk enters, such as one named like an editor backup;
 * every build of such a source would then fail as edited while it was built.
 *
 * A non-root entry observed as a link is refused. The root spelling is admitted
 * before lstat and relies on the materialization owner's source selection.
 * Neither this predicate nor the digest walk pins paths against later changes.
 *
 * @param root The plugin source directory being copied, which is always taken.
 * @param location An entry at or below `root`.
 *
 * @evidence contracts/common.md#principled-implementation Equal resolved root spelling is admitted without kind validation. Other entries use lstat and the digest walk's kind-specific prune/omit policy, refusing observed links; the copy owner owns root validation and post-copy digest comparisons, with sequential pathname observations rather than an atomic snapshot.
 * @evidence contracts/common.md#clear-and-simple-design One copy filter delegates shared name policy and leaves recursive materialization to fs.cpSync.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Kind-aware matching corrects the false assumption that every entry with a directory-like name is a directory, rather than adding filename exceptions.
 * @evidence contracts/common.md#meaningful-documentation Owning prose explains key/copy policy agreement, explicit exclusions, worktree .git files, root admission and non-root link/refusal observation limits.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and lstat preserve filesystem entry kinds without following symbolic links or Windows junctions.
 * @evidence contracts/performance.md#efficient-algorithms Two native path resolutions/comparison precede root admission; other entries add lstat, basename extraction and fixed-policy Set/string queries with path/name costs. The filter allocates no subtree listing; recursive copying and subsequent byte comparisons belong to the materialization owner.
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
