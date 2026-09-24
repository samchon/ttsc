import path from "node:path";
import { prunesPluginSourceDirectory } from "ttsc/plugin-source";

/**
 * Whether a path below a plugin source directory can bear on the sources in the
 * directory's state (`pluginSourceState`, samchon/ttsc#1487), so an observer of
 * the directory as a subtree must hear it.
 *
 * The digest passes over every directory the plugin build prunes
 * (`prunesPluginSourceDirectory`: a nested `node_modules`, a repository's
 * `.git`), so nothing below one moves it, and an observer that watched them
 * would re-prove the digest for every write of a package manager or of Git.
 *
 * @param root The plugin source directory.
 * @param file The path, absolute.
 * @param kind `"directory"` for a directory an observer would watch, which is
 *   passed over when any of its own components is pruned; `"entry"` for the
 *   path an event names, whose own name may be a file the digest reads whatever
 *   it is called, so only the directories above it are checked.
 */
export function pluginSourceCovers(
  root: string,
  file: string,
  kind: "directory" | "entry",
): boolean {
  const relative = path.relative(root, file);
  if (relative === "") return true;
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const components = relative.split(path.sep);
  if (kind === "entry") components.pop();
  return !components.some(prunesPluginSourceDirectory);
}
