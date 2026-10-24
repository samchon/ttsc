import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { flattenDirectoryExclusionOrigins } from "../../tsconfig/flattenDirectoryExclusionOrigins";

/**
 * Apply a native root report without reinterpreting its resolved paths as JSON.
 *
 * @evidence contracts/common.md#principled-implementation Effective native suffixes replace the provisional extension population; parsed output paths replace only implicit output exclusions while authored explicit excludes survive.
 * @evidence contracts/common.md#clear-and-simple-design One projection serves both priming from a previous report and adopting the current compiler report.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native paths are already resolved and are not passed through configDir substitution again; an absent report leaves the policy unchanged.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes resolved compiler paths, JSON interpretation and report absence.
 * @evidence contracts/portability.md#os-neutral-implementation Absolute native output spellings pass through unchanged; this owner performs no path lookup or case folding of filesystem names.
 * @evidence contracts/performance.md#efficient-algorithms Copies the exclusion origins and extension list once, then flattens the existing explicit and implicit directory population; storage follows those names and paths.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller owns report lifetime and reuse permission; this projection retains no prior result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned policy transfers to the caller and acquires no handle or history.
 */
export function applyCompilerMembership(
  policy: ITtscProjectMembershipPolicy,
  report: ITtscCompilerTransformation.IReferenceGraph["membership"],
): ITtscProjectMembershipPolicy {
  if (report === undefined) return policy;
  const origins: {
    exclude: readonly string[];
    useImplicitOutputExclusions?: boolean;
    outDir?: string;
    declarationDir?: string;
  } = {
    ...(policy.directoryExclusionOrigins ?? {
      exclude: policy.excludedDirectories,
      useImplicitOutputExclusions: true,
    }),
  };
  for (const key of ["outDir", "declarationDir"] as const) {
    if (report[key] === null) delete origins[key];
    else origins[key] = report[key];
  }
  return {
    ...policy,
    directoryExclusionOrigins: origins,
    excludedDirectories: flattenDirectoryExclusionOrigins(origins),
    inputExtensions: [...report.inputExtensions],
  };
}
