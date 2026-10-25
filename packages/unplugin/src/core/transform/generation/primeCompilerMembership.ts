import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { hashText } from "../utils/hashText";
import { stableStringify } from "../utils/stableStringify";
import type { TtscCompilerMembershipHint } from "./TtscCompilerMembershipHint";
import { applyCompilerMembership } from "./applyCompilerMembership";

/**
 * Prime a walk with a native hint only while its JSON policy premise matches. A
 * match predicts settings; current native reports and walk proofs remain
 * required.
 *
 * @evidence contracts/common.md#principled-implementation Canonical JSON hashing compares the complete supplied config and overlay policy, including explicit option origins. A changed premise discards the previous projection before the pre-compile walk.
 * @evidence contracts/common.md#clear-and-simple-design One operation returns both the premise identity for capture and the policy to walk; the projection helper retains native path semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Matching config semantics supplies no filesystem freshness claim and cannot certify a post-compile walk as pre-compile evidence.
 * @evidence contracts/common.md#meaningful-documentation Native prose and result members distinguish prediction identity from current generation proof.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Policy paths are serialized as supplied and projected by their owning helper; this function performs no native observation or case rewriting.
 * @evidence contracts/performance.md#efficient-algorithms Canonical serialization sorts record keys and visits policy bytes once before hashing; a matching hint additionally copies the suffix and exclusion population. Temporary storage follows policy size.
 * @evidence contracts/performance.md#reuse-equivalent-work Only a hint learned under the same config policy can prime this walk; no work result, input witness or native authority is reused here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned identity and borrowed or projected policy transfer to the caller; this call retains no cache or resource.
 */
export function primeCompilerMembership(
  policy: ITtscProjectMembershipPolicy,
  hint?: TtscCompilerMembershipHint,
): {
  /** Config-policy identity used to qualify a subsequently learned report. */
  basis: string;

  /** Fresh config policy, optionally projected by an equivalent prior hint. */
  policy: ITtscProjectMembershipPolicy;
} {
  const basis = hashText(stableStringify(policy));
  return {
    basis,
    policy:
      hint?.basis === basis
        ? applyCompilerMembership(policy, hint.report)
        : policy,
  };
}
