import fs from "node:fs";
import path from "node:path";

/**
 * Whether two spellings name one path, compared physically.
 *
 * The compiler reports its inputs, and the adapter writes the compiler's paths,
 * under the project's physical spelling, after every link, while a scenario
 * names the project as it made it, through the macOS temporary directory's link
 * (`/var/…` to `/private/var/…`) or a junction of its own. A path that does not
 * exist, such as a resolution candidate the compiler probed, is compared below
 * its nearest existing ancestor.
 */
export function samePhysicalPath(left: string, right: string): boolean {
  return physical(left) === physical(right);
}

function physical(file: string): string {
  const resolved = path.resolve(file);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    const parent = path.dirname(resolved);
    if (parent === resolved) return resolved;
    return path.join(physical(parent), path.basename(resolved));
  }
}
