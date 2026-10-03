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
 *
 * @evidence contracts/common.md#principled-implementation Name-only fallback applies only when root-file rules are absent; a resolved compiler policy retains its own literal and wildcard semantics.
 * @evidence contracts/common.md#clear-and-simple-design One condition gates the shared fallback predicate, so walkers and event classifiers do not maintain competing ignore lists.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readable configurations do not lose explicitly admitted hidden or package entries through an unconditional host-name blacklist.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain the fallback premise, literal-entry behavior and the shared consumers that require consistent classification.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares an entry name with the ignored-name predicate; no path is parsed.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isIgnoredProjectEntry(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return policy.rootFileSpecs === undefined && isIgnoredProjectDirectory(name);
}
