import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import { isExcludedProjectDirectory } from "./isExcludedProjectDirectory";
import { isIgnoredProjectEntry } from "./isIgnoredProjectEntry";

/**
 * Whether `walkProjectInputs` descends into a directory it meets, by the same
 * three tests it applies to each entry.
 *
 * The directory-level observer on Linux watches exactly these directories, so
 * the project tracker hears every membership change the walk can see and
 * nothing below a directory the walk never enters (samchon/ttsc#1389).
 *
 * @evidence contracts/common.md#principled-implementation Name fallback, configured subtree exclusion and compiler root-pattern admission jointly define directory descent, matching the walk and Linux observer's membership domain.
 * @evidence contracts/common.md#clear-and-simple-design The predicate composes three existing policy owners with short-circuiting rather than duplicating their matching grammars.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Watch admission follows the same configuration semantics as enumeration instead of compensating with an independent directory-name list.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify the three conditions and explain why the Linux observer must share this boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native basename and configured containment use Node path and shared compiler root rules; Linux observer use does not introduce a Linux-only directory policy.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isProjectWalkDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  return (
    !isIgnoredProjectEntry(pathApi.basename(directory), policy) &&
    !isExcludedProjectDirectory(directory, policy, platform) &&
    matchesProjectRootFile(directory, policy, true, platform)
  );
}
