import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Report whether the generation's live watcher would announce a creation at
 * this absent input's exact spelling.
 *
 * Losing the watcher is not evidence of anything, so a failed tracker sends the
 * input back to being probed by hand, exactly as a failed tracker already sends
 * the whole generation back to complete-snapshot validation.
 *
 * @evidence contracts/common.md#principled-implementation The candidate tracker's exact coverage and healthy authoritative notification predicate qualify absence reuse.
 * @evidence contracts/common.md#clear-and-simple-design One adapter selects the absence tracker without duplicating watcher-health policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing or failed candidate observer cannot prove continued absence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain exact spelling and why proof loss returns to direct probing.
 * @evidence contracts/portability.md#os-neutral-implementation Authority comes from observed native delivery capability and the tracker's component-aware overlap semantics.
 */
export function notifiesAbsence(
  cached: TtscCachedProjectTransform,
  input: string,
): boolean {
  return trackerProvesInputUnchanged(cached.candidateMutationTracker, input);
}
