import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { insideExcludedProjectDirectory } from "./insideExcludedProjectDirectory";

/**
 * Whether the resolved configuration keeps this directory out of the program.
 *
 * Compared by lexical containment rather than by name, so `outDir: "./dist"`
 * excludes that one directory instead of every directory called `dist` at every
 * depth, which is the distinction the name list could not draw.
 * The compiler's case policy governs that containment independently of the
 * supplied filesystem view's path grammar.
 *
 * @evidence contracts/common.md#principled-implementation Directory exclusion delegates lexical configured-path containment under the compiler's comparison policy, with exact matches admitted as excluded directories rather than the strict file-entry exemption.
 * @evidence contracts/common.md#clear-and-simple-design A named wrapper fixes the non-strict directory interpretation without duplicating containment logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A configured output location excludes only its own subtree, not every directory sharing its basename.
 * @evidence contracts/common.md#meaningful-documentation The native prose names lexical containment and explains the distinction from historical name-only exclusions.
 * @evidence contracts/portability.md#os-neutral-implementation The explicit filesystem-view platform reaches the containment owner unchanged; native root/separator grammar and compiler case policy remain independent, including the same exact-entry comparison rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isExcludedProjectDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return insideExcludedProjectDirectory(directory, policy, false, platform);
}
