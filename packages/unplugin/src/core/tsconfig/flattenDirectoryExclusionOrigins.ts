import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";

/**
 * Flatten provenance into the directory list consumed by the project walk.
 *
 * Explicit exclude entries replace implicit output-directory defaults, while
 * always retaining their own exclusions.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The implicit-default flag controls output exclusions; explicit exclusion
 *   entries are always appended, preserving TypeScript's replacement rule.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One pure projection owns flattening for both initial and overlaid policies.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Directory choices are supplied by configuration provenance, not guessed
 *   output names or a special branch for a particular bundler.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The comment states the replacement rule and its always-retained half,
 *   providing meaning beyond the array-building expression.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Concatenates already resolved absolute directory strings; it reads no filesystem.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Visits the fixed output-directory option list once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function flattenDirectoryExclusionOrigins(
  origins: NonNullable<
    ITtscProjectMembershipPolicy["directoryExclusionOrigins"]
  >,
): string[] {
  return [
    ...(origins.useImplicitOutputExclusions === false
      ? []
      : OUTPUT_DIRECTORY_OPTIONS.flatMap((key) => {
          const directory = origins[key];
          return directory === undefined ? [] : [directory];
        })),
    ...origins.exclude,
  ];
}
