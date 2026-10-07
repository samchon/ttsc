/**
 * Whether a project-input event is worth a build cycle.
 *
 * Only a change of content or of membership notifies. Being matched by a
 * declared glob is territory, not a change, so `directlyMatched` alone never
 * triggers a rebuild.
 *
 * @evidence contracts/common.md#principled-implementation A content or membership delta establishes changed input; matching declared territory alone establishes neither.
 * @evidence contracts/common.md#clear-and-simple-design One boolean disjunction keeps event admission separate from population classification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A matched path does not manufacture a content change or schedule fixture-specific work.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph distinguishes change from territory following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources projectInputEventShouldNotify acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms projectInputEventShouldNotify performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work projectInputEventShouldNotify computes one result per call, so there is no repeated work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation projectInputEventShouldNotify computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function projectInputEventShouldNotify(input: {
  contentChanged: boolean;
  directlyMatched: boolean;
  membershipChanged: boolean;
}): boolean {
  return input.contentChanged || input.membershipChanged;
}
