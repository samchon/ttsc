import fs from "node:fs";
import path from "node:path";

/**
 * Find each link in a native path and optionally its first blocked component.
 * Follow links before scanning the remaining suffix so a link in a target path
 * can be observed independently of the original alias.
 *
 * @evidence contracts/common.md#principled-implementation Native lstat and readlink expose links and blocked components. Native link expansion precedes dot-parent steps. A sixty-four-link bound stops cycles and expanding targets.
 * @evidence contracts/common.md#clear-and-simple-design Watch and LSP callers share path expansion and own their own subscriptions and fingerprints.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Access errors stop traversal without claiming another link or a missing entry.
 * @evidence contracts/common.md#meaningful-documentation States why a target path needs its own scan.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native roots, path resolution and link metadata, including junctions.
 * @evidence contracts/performance.md#efficient-algorithms Walks path components and followed link spellings without listing or reading directory contents.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current link topology is observed on every call.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The local set lives for one walk. The resulting paths transfer to the caller, with no open handles.
 */
export function pluginInputAliasEntries(
  input: string,
  includeBlocked = true,
): string[] {
  const entries = new Set<string>();
  const separator = process.platform === "win32" ? /[\\/]/ : "/";
  let parent = path.parse(input).root;
  let names = input.slice(parent.length).split(separator);
  let followed = 0;
  for (let index = 0; index < names.length; index++) {
    const name = names[index]!;
    if (name === "" || name === ".") continue;
    if (name === "..") {
      parent = path.dirname(parent);
      continue;
    }
    const entry = path.join(parent, name);
    try {
      const stat = fs.lstatSync(entry, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink()) {
        entries.add(entry);
        // Cap cyclic or expanding link targets. Preserve target components:
        // a preceding link must resolve before '..' chooses its parent.
        if (++followed > 64) break;
        const target = fs.readlinkSync(entry);
        const root = path.parse(target).root;
        if (root !== "") parent = path.parse(path.resolve(parent, target)).root;
        names = [
          ...target.slice(root.length).split(separator),
          ...names.slice(index + 1),
        ];
        index = -1;
        continue;
      }
      if (stat === undefined || !stat.isDirectory()) {
        if (includeBlocked) entries.add(entry);
        break;
      }
    } catch {
      break;
    }
    parent = entry;
  }
  return [...entries];
}
