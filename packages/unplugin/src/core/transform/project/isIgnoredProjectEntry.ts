import { isIgnoredProjectDirectory } from "../../discovery/isIgnoredProjectDirectory";
import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Whether the project walk skips an entry by its name alone.
 *
 * Only a policy whose configuration could not be read needs the name list. A
 * readable one decides every path through TypeScript-Go's own root-file rules,
 * whose wildcards never enter package folders or hidden paths, so `.git`,
 * `.ttsc`, and `node_modules` are already outside it, while a literal entry
 * that names such a directory is honored exactly as TypeScript-Go honors it.
 * The walk, `isProjectWalkPath`, and the live mutation tracker all ask this one
 * question, so the three cannot disagree about a path.
 */
export function isIgnoredProjectEntry(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return policy.rootFileSpecs === undefined && isIgnoredProjectDirectory(name);
}
