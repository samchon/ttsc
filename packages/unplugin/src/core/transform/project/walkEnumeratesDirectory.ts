import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { isProjectWalkDirectory } from "./isProjectWalkDirectory";

/**
 * Whether the project walk rooted at `root` enumerates `directory`, so that its
 * directory snapshot proves the directory's program membership under `policy`
 * (`walkProjectInputs`).
 *
 * The walk lists the root itself and descends into a directory only when every
 * directory on the way to it passes the walk's own test
 * ({@link isProjectWalkDirectory}), the same one the directory-level observer
 * applies, so a directory the walk never enters is never answered for here.
 *
 * @param root The project root the walk started from.
 * @param directory The directory asked about, absolute.
 * @param policy The membership policy the walk ran under.
 */
export function walkEnumeratesDirectory(
  root: string,
  directory: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  const relative = path.relative(root, directory);
  if (relative === "") return true;
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return false;
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (!isProjectWalkDirectory(current, policy)) return false;
  }
  return true;
}
