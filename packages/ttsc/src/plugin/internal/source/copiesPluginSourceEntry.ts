import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Whether a build's copy of a plugin source directory takes the entry at
 * `location`, by the rule its binary is keyed on (`collectPluginSourceFiles`):
 * a directory unless the build passes over it, a regular file unless it is
 * residue, and never a link or any other entry.
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
