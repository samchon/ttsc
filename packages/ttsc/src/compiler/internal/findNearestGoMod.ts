import fs from "node:fs";
import path from "node:path";

/**
 * Walk up the directory tree from `from` looking for a `go.mod` file. Stops
 * after `maxDepth` hops so callers can bound the search to a known
 * neighbourhood of the plugin source directory.
 *
 * Returns the absolute path to the first `go.mod` found, or `null` when no
 * `go.mod` exists within the depth limit or filesystem root is reached first.
 */
export function findNearestGoMod(
  from: string,
  maxDepth: number,
): string | null {
  let current = path.resolve(from);
  let depth = 0;
  while (true) {
    const candidate = path.join(current, "go.mod");
    if (fs.existsSync(candidate)) return candidate;
    if (depth >= maxDepth) return null;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
    depth += 1;
  }
}
