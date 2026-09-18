import type fs from "node:fs";
import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { isIgnoredProjectDirectory } from "../../discovery/isIgnoredProjectDirectory";
import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { isExcludedProjectDirectory } from "./isExcludedProjectDirectory";
import { isPossibleProgramFileName } from "./isPossibleProgramFileName";

/**
 * Report whether an absolute `file` belongs to the project walk universe of
 * `root`: it lies under `root`, every component exists without traversing a
 * symbolic link, the leaf is a regular file, and no segment of the relative
 * path is ignored. The predicate mirrors `walkProjectInputs` exactly, so
 * "walk-visible" here means "hashed by `collectProjectInputHashes`". Missing
 * paths and files reached through symlinks or Windows junctions are out-of-walk
 * inputs that only the reference graph can prove relevant.
 */
export function isProjectWalkPath(
  root: string,
  file: string,
  _identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): boolean {
  // Walk membership is lexical. Resolving `file` to physical identity first
  // would turn `root/alias/value.ts` into `root/target/value.ts`, hide the
  // symlink segment from the lstat loop below, and falsely claim the project
  // walk hashed a path it deliberately never followed.
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, path.resolve(file));
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return false;
  }
  const segments = relative.split(path.sep);
  // The last segment is the file itself, which the walk names rather than
  // descends into, so only the directory components decide walk membership.
  if (segments.slice(0, -1).some(isIgnoredProjectDirectory)) {
    return false;
  }
  if (isExcludedProjectDirectory(path.dirname(path.resolve(file)), policy)) {
    return false;
  }
  // The walk hashes only files that could enter the program, so a path it does
  // not hash is out of the walk by definition. Answering otherwise would leave
  // a graph input the compiler really read in neither snapshot: absent from
  // `inputHashes` because the walk skipped it, and absent from the out-of-walk
  // snapshot because this predicate claimed the walk covered it.
  if (
    !isPossibleProgramFileName(path.basename(file), policy) ||
    !matchesProjectRootFile(file, policy, false)
  ) {
    return false;
  }
  let current = resolvedRoot;
  for (let index = 0; index < segments.length; ++index) {
    current = path.join(current, segments[index]!);
    let stats: fs.BigIntStats;
    try {
      stats = filesystem.lstat(current);
    } catch {
      return false;
    }
    if (stats.isSymbolicLink()) {
      return false;
    }
    const leaf = index === segments.length - 1;
    if ((leaf && !stats.isFile()) || (!leaf && !stats.isDirectory())) {
      return false;
    }
  }
  return true;
}
