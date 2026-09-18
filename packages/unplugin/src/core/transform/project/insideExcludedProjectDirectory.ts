import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Whether a path lies inside a directory the configuration excludes.
 *
 * Lexical, exactly like the walk and like {@link isProjectWalkPath}, and for the
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
 */
export function insideExcludedProjectDirectory(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  strictly: boolean,
): boolean {
  if (policy.excludedDirectories.length === 0) {
    return false;
  }
  const resolved = path.resolve(location);
  return policy.excludedDirectories.some((excluded) => {
    const target = path.resolve(excluded);
    if (strictly && target === resolved) {
      return false;
    }
    return pathIsWithin(resolved, target);
  });
}
