import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { insideExcludedProjectDirectory } from "./insideExcludedProjectDirectory";

/**
 * Whether the resolved configuration keeps this directory out of the program.
 *
 * Compared by lexical containment rather than by name, so `outDir: "./dist"`
 * excludes that one directory instead of every directory called `dist` at every
 * depth, which is the distinction the name list could not draw.
 *
 * @evidence contracts/common.md#principled-implementation Directory exclusion delegates lexical configured-path containment with exact matches admitted as excluded directories, matching the walk's directory boundary.
 * @evidence contracts/common.md#clear-and-simple-design A named wrapper fixes the non-strict directory interpretation without duplicating containment logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A configured output location excludes only its own subtree, not every directory sharing its basename.
 * @evidence contracts/common.md#meaningful-documentation The native prose names lexical containment and explains the distinction from historical name-only exclusions.
 * @evidence contracts/portability.md#os-neutral-implementation Native containment is delegated unchanged, keeping this directory interpretation consistent with the shared root and separator rules on every supported OS.
 */
export function isExcludedProjectDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return insideExcludedProjectDirectory(directory, policy, false, platform);
}
