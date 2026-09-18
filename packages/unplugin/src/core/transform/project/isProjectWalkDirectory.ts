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
 */
export function isProjectWalkDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return (
    !isIgnoredProjectEntry(path.basename(directory), policy) &&
    !isExcludedProjectDirectory(directory, policy) &&
    matchesProjectRootFile(directory, policy, true)
  );
}
