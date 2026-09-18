import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { insideExcludedProjectDirectory } from "./insideExcludedProjectDirectory";
import { isIgnoredProjectEntry } from "./isIgnoredProjectEntry";
import { isPossibleProgramFileName } from "./isPossibleProgramFileName";

/**
 * Whether one directory event can be a change to the program's membership.
 *
 * The live tracker has to answer the same question the membership digest does,
 * or the two disagree about the same project: a bundler writing content-hashed
 * output fires a rename per rebuild, and treating that as membership kept the
 * cost samchon/ttsc#1307 removes on every host that has no build boundary,
 * which is every host the narrow path exists for.
 *
 * A name that could be a program input counts, unless it sits under a directory
 * the walk never descends into. A name that could not still counts when the
 * path is now a directory, because the walk's watches were opened for the
 * directories that existed when the generation was captured, so a directory
 * created since is not watched and the sources that may appear in it would
 * otherwise be invisible. A directory the configuration excludes is the
 * exception: the walk cannot see inside it, so the tracker must not either, or
 * emptying and recreating an `outDir` costs a compile per build. A path below a
 * name the walk skips never counts for the same reason. An event whose name the
 * host did not report is unattributable and always counts.
 */
export function reportsProgramMembership(
  root: string,
  location: string,
  filename: string,
  policy: ITtscProjectMembershipPolicy,
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  if (
    path
      .relative(root, location)
      .split(path.sep)
      .some((segment) => isIgnoredProjectEntry(segment, policy))
  ) {
    return false;
  }
  if (
    !matchesProjectRootFile(location, policy, false) &&
    !matchesProjectRootFile(location, policy, true)
  ) {
    return false;
  }
  try {
    if (filesystem.lstat(location).isDirectory()) {
      return (
        matchesProjectRootFile(location, policy, true) &&
        !insideExcludedProjectDirectory(location, policy, false)
      );
    }
  } catch {
    // Deleted file names still need classification below.
  }
  if (isPossibleProgramFileName(filename, policy)) {
    // A name the program could admit. It still says nothing if it lies inside a
    // directory the walk never descends into, because the digest cannot see
    // there either and the tracker must not be the one side that reacts.
    return (
      matchesProjectRootFile(location, policy, false) &&
      !insideExcludedProjectDirectory(location, policy, true)
    );
  }
  // Removed directories report their source removals through their own watch.
  // A non-source file name cannot introduce program membership.
  return false;
}
