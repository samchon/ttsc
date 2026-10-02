import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { recordProjectChange } from "./recordProjectChange";

/**
 * Mark program membership as changed and retain a bounded path sample.
 *
 * Membership remains changed after later content-only events, because one
 * structural event already invalidates reuse of the previous member set.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A monotone boolean records structural invalidation independently of the
 *   diagnostic path sample maintained by recordProjectChange.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One assignment and the shared sample operation keep membership semantics
 *   separate from the content-event helper without duplicating sample policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Every admitted structural event takes the same invalidation path; no
 *   filename-specific exemption can preserve a stale membership proof.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain the operation and why membership invalidation
 *   remains monotone, following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One boolean assignment delegates bounded Set work, including path-string
 *   hashing/comparison cost. It allocates no independent event stream.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Repeated structural events reuse the existing invalidation bit and exact
 *   path entries; generations remain isolated by tracker ownership.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Only the caller's bounded tracker sample and boolean survive the call;
 *   no independent event history or native resource is allocated.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Sets a flag and delegates to recordProjectChange; no path is parsed or compared.
 */
export function recordProjectMutation(
  tracker: TtscProjectMutationTracker,
  changed: string,
): void {
  tracker.membershipChanged = true;
  recordProjectChange(tracker, changed);
}
