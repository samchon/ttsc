import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { insideExcludedProjectDirectory } from "./insideExcludedProjectDirectory";

/**
 * Whether the resolved configuration keeps this directory out of the program.
 *
 * Compared by physical containment rather than by name, so `outDir: "./dist"`
 * excludes that one directory instead of every directory called `dist` at every
 * depth, which is the distinction the name list could not draw.
 */
export function isExcludedProjectDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return insideExcludedProjectDirectory(directory, policy, false);
}
