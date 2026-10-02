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
 * Configured root selection and exclusions determine lexical relevance. This
 * answer does not establish that a rejected native event spelling has no alias
 * among program inputs; the owning tracker handles that authority separately.
 *
 * A name that could be a program input counts, unless it sits under a directory
 * the walk never descends into. A name that could not still counts when the
 * path is now a directory, because the walk's watches were opened for the
 * directories that existed when the generation was captured, so a directory
 * created since is not watched and the sources that may appear in it would
 * otherwise be invisible. A directory the configuration excludes is the
 * exception: the walk cannot see inside it, so the tracker must not either, or
 * emptying and recreating an `outDir` costs a compile per build. A path below a
 * name the walk skips never counts for the same reason. Callers handle
 * unattributable events separately; this predicate classifies a named path.
 *
 * @evidence contracts/common.md#principled-implementation The same root-file and directory-exclusion policy classifies named event locations as the walk; current directory kind admits newly created source-containing subtrees while removed source filenames remain classifiable.
 * @evidence contracts/common.md#clear-and-simple-design Policy gates precede one optional lstat, then filename classification handles deletion without requiring a current entry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Output events are ignored by actual compiler admission and configured containment, not by broad directory-name exceptions that could hide real inputs.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain creation, deletion and output exclusion; the final sentence distinguishes caller-owned unattributable events from this named-path predicate.
 * @evidence contracts/portability.md#os-neutral-implementation Native relative paths and separators classify event components, and the injected lstat view distinguishes directories from deleted filenames; no platform-wide lowercase rule substitutes for compiler admission.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Relative-path construction and splitting allocate text and segment
 *   references proportional to the event path. Early policy gates precede at
 *   most one native lstat. Root matching includes configured patterns, path
 *   components and spelling variants; exclusion scans configured directory
 *   paths, and filename eligibility scans the supplied extensions. Repeated
 *   root questions share the matching owner's immutable-policy compilation,
 *   while the current kind observation remains local to this event.
 *   Component regular-expression evaluation depends on component text and
 *   compiled wildcard expressions; the state count alone is not a bound on
 *   that work, and this adapter establishes no linear regex-time guarantee.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function reportsProgramMembership(
  root: string,
  location: string,
  filename: string,
  policy: ITtscProjectMembershipPolicy,
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  const platform = filesystem.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (
    pathApi
      .relative(root, location)
      .split(pathApi.sep)
      .some((segment) => isIgnoredProjectEntry(segment, policy))
  ) {
    return false;
  }
  if (
    !matchesProjectRootFile(location, policy, false, platform) &&
    !matchesProjectRootFile(location, policy, true, platform)
  ) {
    return false;
  }
  try {
    if (filesystem.lstat(location).isDirectory()) {
      return (
        matchesProjectRootFile(location, policy, true, platform) &&
        !insideExcludedProjectDirectory(location, policy, false, platform)
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
      matchesProjectRootFile(location, policy, false, platform) &&
      !insideExcludedProjectDirectory(location, policy, true, platform)
    );
  }
  // Removed directories report their source removals through their own watch.
  // A non-source file name cannot introduce program membership.
  return false;
}
