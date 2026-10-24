import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { applyCompilerMembership } from "./applyCompilerMembership";

/**
 * Replace provisional root settings and comparison rules with native reports.
 *
 * Capture supplies an explicit priming answer before walking. An exception or
 * an envelope without reports leaves that same policy intact. A differing
 * report marks the old walk for refusal; this operation neither performs the
 * walk nor establishes that a predicted answer matched the native compiler.
 *
 * @evidence contracts/common.md#principled-implementation Native case, suffix and output settings replace provisional answers; set equality determines whether a fresh walk is needed. Missing reports preserve the original policy identity and explicit excludes retain authored provenance.
 * @evidence contracts/common.md#clear-and-simple-design One report-selection operation returns the policy and changed-rule fact; capture retains ownership of enumeration authority and proof refusal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No OS label or filesystem probe substitutes for a compiler report, and no report supplies missing walk evidence.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the explicit primer requirement, missing-report identity and changed-policy refusal boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path comparison maps only observed project root aliases to a shared anchor. Child lexical names remain distinct; case folding uses the compiler report, never an OS-name guess.
 * @evidence contracts/performance.md#efficient-algorithms Missing reports borrow the policy. Available settings copy extension/exclusion populations; Set comparisons visit their names and path text, with Node relative/normalize work for each exclusion under at most three observed anchors. Temporary storage follows those populations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Selects this envelope's reported rule without retaining a memo or certifying reuse of the primed walk.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Borrows the primer or returns a shallow policy object; capture owns retained policy and observer lifetimes, with no handle or historical state acquired here.
 */
export function selectReportedMembershipPolicy(
  primed: ITtscProjectMembershipPolicy & { useCaseSensitiveFileNames: boolean },
  result: ITtscCompilerTransformation,
): {
  /** Borrowed primer or native settings overlay for this capture's validators. */
  membershipPolicy: ITtscProjectMembershipPolicy;

  /** Whether the primed walk used a different rule from this compiler report. */
  membershipPolicyLearned: boolean;
} {
  const reported =
    result.type === "exception"
      ? undefined
      : result.graph?.useCaseSensitiveFileNames;
  const rootReport =
    result.type === "exception" ? undefined : result.graph?.membership;
  const policy = applyCompilerMembership(
    reported === undefined
      ? primed
      : { ...primed, useCaseSensitiveFileNames: reported },
    rootReport,
  );
  const canonical = (value: string): string =>
    policy.useCaseSensitiveFileNames === false ? value.toLowerCase() : value;
  const directoryKey = (directory: string): string => {
    const root = primed.rootFileSpecs?.root;
    if (root !== undefined)
      for (const anchor of [root.path, root.realpath, root.nativepath]) {
        if (anchor === undefined) continue;
        const relative = path.relative(anchor, directory);
        if (
          relative === "" ||
          (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(".." + path.sep))
        )
          return "root:" + canonical(relative);
      }
    return "absolute:" + canonical(path.normalize(directory));
  };
  const sameSet = (
    left: readonly string[],
    right: readonly string[],
    key: (value: string) => string,
  ): boolean => {
    const a = new Set(left.map(key));
    const b = new Set(right.map(key));
    return a.size === b.size && [...a].every((entry) => b.has(entry));
  };
  return {
    membershipPolicy: policy,
    membershipPolicyLearned:
      (reported !== undefined &&
        reported !== primed.useCaseSensitiveFileNames) ||
      !sameSet(primed.inputExtensions, policy.inputExtensions, (value) =>
        value.toLowerCase(),
      ) ||
      !sameSet(
        primed.excludedDirectories,
        policy.excludedDirectories,
        directoryKey,
      ),
  };
}
