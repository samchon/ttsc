/**
 * Whether a project-input event is worth a build cycle.
 *
 * Only a change of content or of membership notifies. Being matched by a
 * declared glob is territory, not a change, so `directlyMatched` alone never
 * triggers a rebuild.
 */
export function projectInputEventShouldNotify(input: {
  contentChanged: boolean;
  directlyMatched: boolean;
  membershipChanged: boolean;
}): boolean {
  return input.contentChanged || input.membershipChanged;
}
