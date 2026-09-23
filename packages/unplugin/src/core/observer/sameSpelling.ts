import path from "node:path";

/**
 * Whether two paths are the same lexical spelling on this platform.
 *
 * Windows compares case-insensitively and every other platform compares
 * exactly. This decides whether a resolved target differs from its lexical
 * path, and therefore whether a link has to be tracked.
 */
export function sameSpelling(left: string, right: string): boolean {
  return process.platform === "win32"
    ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
    : path.resolve(left) === path.resolve(right);
}
