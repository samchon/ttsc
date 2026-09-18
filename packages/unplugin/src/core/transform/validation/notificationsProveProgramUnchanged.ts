import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { isProjectWalkPath } from "../project/isProjectWalkPath";
import { notificationsProveMembership } from "../tracker/notificationsProveMembership";
import { matchesUniversalHostInputs } from "./matchesUniversalHostInputs";

/**
 * Whether the generation's live notifications prove its program could not have
 * changed since capture (samchon/ttsc#1398).
 *
 * A module outside the program stays outside it until the program changes: a
 * config admits it, or an input starts importing it. Either one is an event the
 * generation's watchers report, a membership change, a content change of a
 * program input, or a changed universal input. While none has been reported and
 * every watcher can vouch for content, the out-of-program answer holds, and the
 * delivery skips the project walk it used to pay every time.
 */
export function notificationsProveProgramUnchanged(
  cached: TtscCachedProjectTransform,
): boolean {
  if (!notificationsProveMembership(cached)) return false;
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ]) {
    if (tracker === undefined) continue;
    if (
      tracker.contentAuthoritative !== true ||
      tracker.membershipChanged ||
      tracker.changesOmitted
    ) {
      return false;
    }
    for (const changed of tracker.changes) {
      // The project observer also hears paths the walk never enters, such as
      // a package directory named like a source; only what the walk covers
      // can be a program input. Every other tracker's paths are inputs.
      if (
        tracker !== cached.projectMutationTracker ||
        isProjectWalkPath(
          cached.projectRoot,
          changed,
          undefined,
          resultFilesystem(cached.result),
          cached.membershipPolicy,
        )
      ) {
        return false;
      }
    }
  }
  return (
    cached.projectMutationTracker !== undefined &&
    cached.hostInputValidation !== undefined &&
    matchesUniversalHostInputs(cached, cached.hostInputValidation)
  );
}
