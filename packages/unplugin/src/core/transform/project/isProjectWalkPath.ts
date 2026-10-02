import type fs from "node:fs";
import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { isExcludedProjectDirectory } from "./isExcludedProjectDirectory";
import { isIgnoredProjectEntry } from "./isIgnoredProjectEntry";
import { isPossibleProgramFileName } from "./isPossibleProgramFileName";

/**
 * Report whether an absolute `file` belongs to the project walk universe of
 * `root`: it lies under `root`, each component below that root exists without
 * traversing a symbolic link, the leaf is a regular file, and the configured
 * name, directory and file rules admit it. This establishes current walk
 * eligibility, not that a particular capture actually read or hashed it. Missing
 * paths and files reached through symlinks or Windows junctions are out-of-walk
 * inputs that only the reference graph can prove relevant.
 *
 * @evidence contracts/common.md#principled-implementation Lexical root containment, admitted filename policy and lstat of every component establish that the actual walk reaches this regular file without traversing a symlink or junction.
 * @evidence contracts/common.md#clear-and-simple-design Ordered early rejections separate containment, policy and filesystem-kind checks; physical identity is deliberately not substituted for lexical traversal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable, missing and linked paths remain out-of-walk so graph proof must cover them instead of silently treating an unvisited physical target as hashed.
 * @evidence contracts/common.md#meaningful-documentation The native summary states the complete walk-membership premise, and inline paragraphs explain why canonical identity and unadmitted extensions cannot stand in for traversal.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path operations preserve root and drive boundaries, while the supplied lstat view detects symbolic links and Windows junctions without assuming global filesystem case sensitivity.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Resolves lexical root/file text, splits components, checks configured
 *   exclusions and compiler patterns, then performs one native lstat per
 *   reached component until rejection. Costs include path/extension text,
 *   policy pattern populations and native component observations; joining
 *   successive prefixes also processes their growing text. No byte read or
 *   recursive directory enumeration is needed for this eligibility query.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This reports current native walk eligibility, not a saved capture proof.
 *   Mutation can change the answer for the same spelling; enclosing validation
 *   owns when an earlier observation may be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isProjectWalkPath(
  /** Lexical project boundary; only components below it are inspected here. */
  root: string,
  /** Native file address whose present walk eligibility is requested. */
  file: string,
  _identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): boolean {
  const platform = filesystem.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  // Walk membership is lexical. Resolving `file` to physical identity first
  // would turn `root/alias/value.ts` into `root/target/value.ts`, hide the
  // symlink segment from the lstat loop below, and falsely claim the project
  // walk hashed a path it deliberately never followed.
  const resolvedRoot = pathApi.resolve(root);
  const relative = pathApi.relative(resolvedRoot, pathApi.resolve(file));
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relative)
  ) {
    return false;
  }
  const segments = relative.split(pathApi.sep);
  // The last segment is the file itself, which the walk names rather than
  // descends into, so only the directory components decide walk membership.
  if (
    segments
      .slice(0, -1)
      .some((segment) => isIgnoredProjectEntry(segment, policy))
  ) {
    return false;
  }
  if (isExcludedProjectDirectory(pathApi.dirname(pathApi.resolve(file)), policy, platform)) {
    return false;
  }
  // The walk hashes only files that could enter the program, so a path it does
  // not hash is out of the walk by definition. Answering otherwise would leave
  // a graph input the compiler really read in neither snapshot: absent from
  // `inputHashes` because the walk skipped it, and absent from the out-of-walk
  // snapshot because this predicate claimed the walk covered it.
  if (
    !isPossibleProgramFileName(pathApi.basename(file), policy) ||
    !matchesProjectRootFile(file, policy, false, platform)
  ) {
    return false;
  }
  let current = resolvedRoot;
  for (let index = 0; index < segments.length; ++index) {
    current = pathApi.join(current, segments[index]!);
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
