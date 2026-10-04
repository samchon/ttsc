import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Replace a capture's provisional compiler comparison rule with its report.
 *
 * Capture supplies an explicit priming answer before walking. An exception or
 * an envelope without a case report leaves that same policy intact. A differing
 * report marks the old walk for refusal; this operation neither performs the
 * walk nor establishes that a predicted answer matched the native compiler.
 *
 * @evidence contracts/common.md#principled-implementation An available compiler boolean, including false, overrides the explicit priming answer; equality determines whether the capture learned a different rule. Missing reports retain the original policy identity.
 * @evidence contracts/common.md#clear-and-simple-design One report-selection operation returns the policy and changed-rule fact; capture retains ownership of enumeration authority and proof refusal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No OS label or filesystem probe substitutes for a compiler report, and no report supplies missing walk evidence.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the explicit primer requirement, missing-report identity and changed-policy refusal boundary.
 * @evidence contracts/portability.md#os-neutral-implementation The compiler's reported comparison policy wins independently of host path grammar; the explicit primer remains provisional and native prediction or probing is outside this operation.
 * @evidence contracts/performance.md#efficient-algorithms Missing reports return the borrowed policy; an available report shallow-copies its own fields once. Work and temporary object space follow policy field count, without traversing nested specifications.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Selects this envelope's reported rule without retaining a memo or certifying reuse of the primed walk.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Borrows the primer or returns a shallow policy object; capture owns retained policy and observer lifetimes, with no handle or historical state acquired here.
 */
export function selectReportedMembershipPolicy(
  primed: ITtscProjectMembershipPolicy & { useCaseSensitiveFileNames: boolean },
  result: ITtscCompilerTransformation,
): {
  /** Borrowed primer or reported-case overlay for this capture's validators. */
  membershipPolicy: ITtscProjectMembershipPolicy;

  /** Whether the primed walk used a different rule from this compiler report. */
  casePolicyLearned: boolean;
} {
  const reported =
    result.type === "exception"
      ? undefined
      : result.graph?.useCaseSensitiveFileNames;
  return {
    membershipPolicy:
      reported === undefined
        ? primed
        : { ...primed, useCaseSensitiveFileNames: reported },
    casePolicyLearned:
      reported !== undefined && reported !== primed.useCaseSensitiveFileNames,
  };
}
