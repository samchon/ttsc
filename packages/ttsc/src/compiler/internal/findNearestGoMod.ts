import fs from "node:fs";
import path from "node:path";

/**
 * Walk up the directory tree from `from` looking for a `go.mod` file. Stops
 * after `maxDepth` hops so callers can bound the search to a known
 * neighbourhood of the plugin source directory.
 *
 * Returns the absolute path to the first `go.mod` found, or `null` when no
 * `go.mod` exists within the depth limit or filesystem root is reached first.
 * Only regular files qualify; a directory named go.mod is not module metadata.
 *
 * @evidence contracts/common.md#principled-implementation Searching the starting directory then at most maxDepth parents implements the plugin module's nearest-owner rule; regular-file status distinguishes metadata from an identically named directory.
 * @evidence contracts/common.md#clear-and-simple-design One bounded ancestry walk owns module discovery, while the caller owns plugin-source validation and interpretation of the resulting module root.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The search follows module ancestry and an explicit supported depth, without guessing a module from a particular plugin name or fixture layout.
 * @evidence contracts/common.md#meaningful-documentation The native comment defines inclusive starting-directory search, parent limit, absence and file-kind requirements in separated prose following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and parent traversal handle platform roots; stat follows filesystem symlinks to actual regular module files without an OS-derived case assumption.
 * @evidence contracts/performance.md#efficient-algorithms At most maxDepth plus one metadata probes are needed, fewer at a filesystem root; a single current path avoids retaining all visited ancestors.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Nearby go.mod files can appear or disappear; this query has no watcher or dependency identity authorizing persistent cross-request reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous walk owns no retained descriptors or historical state and transfers its nullable path result to the caller.
 */
export function findNearestGoMod(
  from: string,
  maxDepth: number,
): string | null {
  let current = path.resolve(from);
  let depth = 0;
  while (true) {
    const candidate = path.join(current, "go.mod");
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
      return candidate;
    }
    if (depth >= maxDepth) return null;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
    depth += 1;
  }
}
