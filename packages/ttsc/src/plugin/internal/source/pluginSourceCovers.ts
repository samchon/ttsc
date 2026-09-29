import path from "node:path";

import { prunesPluginSourceDirectory } from "./prunesPluginSourceDirectory";

/**
 * Whether a path below a plugin source directory can bear on the sources in the
 * directory's state (`pluginSourceState`, samchon/ttsc#1487), so an observer of
 * the directory as a subtree must hear it.
 *
 * The plugin build passes over every directory it prunes
 * (`prunesPluginSourceDirectory`: a nested `node_modules`, a repository's
 * `.git`), so nothing below one moves the state, and an observer that watched
 * them would re-prove the state, or rebuild, for every write of a package
 * manager or of Git. `ttsc --watch` and `@ttsc/unplugin`'s observers answer the
 * question with this one rule (samchon/ttsc#1492). An injected filesystem
 * observer can supply its path grammar explicitly; native compiler and
 * filesystem callers retain the current process default.
 *
 * @param root The plugin source directory.
 * @param file The path, absolute.
 * @param kind `"directory"` for a directory an observer would watch, which is
 *   passed over when any of its own components is pruned; `"entry"` for the
 *   path an event names, whose own name may be a file the build reads whatever
 *   it is called, so only the directories above it are checked.
 * @param platform The observed path grammar, defaulting to the current process.
 *
 * @evidence contracts/common.md#principled-implementation Relative containment uses the observed path grammar to reject paths outside the source; omitting the final component for entry events preserves files whose names happen to match pruned directory names.
 * @evidence contracts/common.md#clear-and-simple-design One kind discriminant separates watched-directory membership from event-entry membership without duplicating path containment logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The same shared prune predicate controls source observers rather than a local list adjusted to a particular watcher failure.
 * @evidence contracts/common.md#meaningful-documentation Native parameter comments explain why a directory's own name counts while an event entry's own name may still be a source file.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit win32/posix grammar follows the observer's filesystem view while native callers default to process.platform; lexical containment establishes neither physical alias identity nor a volume's case capability.
 * @evidence contracts/performance.md#efficient-algorithms Relative-path construction and one component scan cost O(P) time and O(P) temporary path/component space, without filesystem enumeration.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This is a current path-policy query; watcher and source-state reuse belong to consumers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No watcher or persistent handle is acquired here.
 */
export function pluginSourceCovers(
  root: string,
  file: string,
  kind: "directory" | "entry",
  platform: NodeJS.Platform = process.platform,
): boolean {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const relative = paths.relative(root, file);
  if (relative === "") return true;
  if (
    relative === ".." ||
    relative.startsWith(`..${paths.sep}`) ||
    paths.isAbsolute(relative)
  )
    return false;
  const components = relative.split(paths.sep);
  if (kind === "entry") components.pop();
  return !components.some(prunesPluginSourceDirectory);
}
