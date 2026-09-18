import fs from "node:fs";
import path from "node:path";

import { realpath } from "./realpath";

/**
 * Return the linked directory components between `root` and `file`.
 *
 * Retargeting a symlink or junction moves every path beneath it without an
 * event on those paths, so each link along the way must be tracked in its own
 * right. Results are memoized per component key, and a missing component stops
 * the walk, because nothing below a missing directory can exist yet.
 */
export function linkedComponents(
  file: string,
  root: string,
  cached: Map<string, string | null>,
  missing: Set<string>,
  keyOf: (file: string) => string,
): string[] {
  const relative = path.relative(root, file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return [];
  const output: string[] = [];
  let current = path.resolve(root);
  for (const component of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, component);
    const key = keyOf(current);
    if (missing.has(key)) break;
    const known = cached.get(key);
    if (known !== undefined) {
      if (known !== null) output.push(current);
      continue;
    }
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        cached.set(key, realpath(current) ?? current);
        output.push(current);
      } else {
        cached.set(key, null);
      }
    } catch {
      missing.add(key);
      break;
    }
  }
  return output;
}
