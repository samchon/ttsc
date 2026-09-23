import fs from "node:fs";
import path from "node:path";

/**
 * Return the nearest existing directory at or above `file` that a recursive
 * watch can own, or `undefined` when only a volume root remains.
 *
 * A missing input is observed through the directory that will announce its
 * creation. A volume root is never watched recursively, since that would
 * observe an unbounded, unrelated tree.
 */
export function nearestExistingDirectory(file: string): string | undefined {
  let current = path.resolve(file);
  try {
    if (!fs.statSync(current).isDirectory()) current = path.dirname(current);
  } catch {
    current = path.dirname(current);
  }
  for (;;) {
    try {
      if (fs.statSync(current).isDirectory()) {
        return path.dirname(current) === current ? undefined : current;
      }
    } catch {
      // Keep climbing to the nearest directory a recursive watch can own.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
