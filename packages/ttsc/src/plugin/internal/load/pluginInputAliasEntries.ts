import fs from "node:fs";
import path from "node:path";

/**
 * Find each link in a native path and the first missing component. Follow links
 * before scanning the remaining suffix so a link in a target path can be
 * observed independently of the original alias.
 *
 * @evidence contracts/common.md#principled-implementation Native lstat and readlink expose link entries and missing components while a visited set terminates repeated links.
 * @evidence contracts/common.md#clear-and-simple-design Watch and LSP callers share path expansion and own their own subscriptions and fingerprints.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Access errors stop traversal without claiming another link or a missing entry.
 * @evidence contracts/common.md#meaningful-documentation States why a target path needs its own scan.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native roots, path resolution and link metadata, including junctions.
 * @evidence contracts/performance.md#efficient-algorithms Walks path components and followed link spellings without listing or reading directory contents.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current link topology is observed on every call.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The local set lives for one walk. The resulting paths transfer to the caller, with no open handles.
 */
export function pluginInputAliasEntries(input: string): string[] {
  const entries = new Set<string>();
  let location = input;
  for (;;) {
    const root = path.parse(location).root;
    const names = location.slice(root.length).split(path.sep).filter(Boolean);
    let parent = root;
    let followed = false;
    for (let index = 0; index < names.length; index++) {
      const entry = path.join(parent, names[index]!);
      try {
        const stat = fs.lstatSync(entry, { throwIfNoEntry: false });
        if (stat === undefined) {
          entries.add(entry);
          return [...entries];
        }
        if (stat.isSymbolicLink()) {
          if (entries.has(entry)) return [...entries];
          entries.add(entry);
          location = path.resolve(
            parent,
            fs.readlinkSync(entry),
            ...names.slice(index + 1),
          );
          followed = true;
          break;
        }
        if (!stat.isDirectory()) return [...entries];
      } catch {
        return [...entries];
      }
      parent = entry;
    }
    if (!followed) return [...entries];
  }
}
