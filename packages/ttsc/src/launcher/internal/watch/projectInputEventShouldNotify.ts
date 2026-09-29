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
 */
export function projectInputEventShouldNotify(input: {
  contentChanged: boolean;
  directlyMatched: boolean;
  membershipChanged: boolean;
}): boolean {
  return input.contentChanged || input.membershipChanged;
}
