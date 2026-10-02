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
 *
 * @evidence contracts/common.md#principled-implementation Lexical root containment and admission of every relative directory component establish that the walk's descent policy reaches the named directory; the root itself is always enumerated.
 * @evidence contracts/common.md#clear-and-simple-design One relative-path rejection and a component loop reuse the shared directory predicate rather than approximating its grammar.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A leaf accepted by itself cannot conceal an excluded ancestor, and physical alias canonicalization does not stand in for the walk's lexical path.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs define enumeration coverage and explain ancestor admission; parameter tags identify the exact walk root and policy.
 * @evidence contracts/portability.md#os-neutral-implementation Node relative/join operations and native separators preserve volume boundaries; lexical component admission deliberately follows the walk rather than collapsing aliases through realpath.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Joins and checks each segment of the relative path once, from the root
 *   downwards.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function walkEnumeratesDirectory(
  root: string,
  directory: string,
  policy: ITtscProjectMembershipPolicy,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const relative = pathApi.relative(root, directory);
  if (relative === "") return true;
  if (
    relative === ".." ||
    relative.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relative)
  ) {
    return false;
  }
  let current = root;
  for (const segment of relative.split(pathApi.sep)) {
    current = pathApi.join(current, segment);
    if (!isProjectWalkDirectory(current, policy, platform)) return false;
  }
  return true;
}
