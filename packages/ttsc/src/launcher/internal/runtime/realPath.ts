import fs from "node:fs";

/**
 * The physical path, in the same spelling the launcher decided on.
 *
 * `realpathSync.native` first, because the plain implementation resolves
 * reparse points but leaves a Windows 8.3 component alone — and `TEMP` is
 * `C:\Users\RUNNER~1\...` on a GitHub Windows runner. The launcher resolves the
 * entry through `fs.realpathSync.native`, so answering here with the short name
 * would put a `..` in `path.relative(rootDir, real)`, drop the exact-mirror
 * lane, and leave the entry to whatever the trailing-stem matcher picks.
 */
export function realPath(target: string): string {
  try {
    return fs.realpathSync.native?.(target) ?? fs.realpathSync(target);
  } catch {
    return target;
  }
}
