import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Whether a path lies inside a directory the configuration excludes.
 *
 * Lexical, exactly like the walk and like `isProjectWalkPath`, and for the
 * reason that predicate states: walk membership is lexical, so resolving a path
 * to physical identity first would collapse two spellings the walk keeps apart
 * and claim it covered a subtree it never followed. A junction whose target the
 * walk hashes under its own name is exactly that, and canonicalizing here would
 * suppress every event in it.
 *
 * `strictly` excludes an exact match, for the case where the excluded entry
 * names a file rather than a directory: `exclude` accepts one, the walk applies
 * exclusion to directories alone, so that file is still hashed and its events
 * must keep counting.
 *
 * @evidence contracts/common.md#principled-implementation Native lexical containment compares the configured excluded locations without collapsing symlink spellings; strict mode excludes the exact entry so directory-only exclusion does not misclassify a file.
 * @evidence contracts/common.md#clear-and-simple-design An empty-policy fast path and one containment scan share the existing path boundary helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exclusion follows actual configured locations rather than generic directory-name exceptions or physical normalization that erases unwalked aliases.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain lexical walk membership and the exact-match exception for excluded file entries.
 * @evidence contracts/portability.md#os-neutral-implementation Node path resolution and the shared native containment helper preserve roots, drives and separator boundaries without case folding lexical spellings or resolving links the walk never follows.
 */
export function insideExcludedProjectDirectory(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  strictly: boolean,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (policy.excludedDirectories.length === 0) {
    return false;
  }
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolved = pathApi.resolve(location);
  return policy.excludedDirectories.some((excluded) => {
    const target = pathApi.resolve(excluded);
    if (strictly && target === resolved) {
      return false;
    }
    return pathIsWithin(resolved, target, platform);
  });
}
