import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Report whether the generation's live watcher would announce a creation at
 * this absent input's exact spelling.
 *
 * Losing the watcher is not evidence of anything, so a failed tracker sends the
 * input back to being probed by hand, exactly as a failed tracker already sends
 * the whole generation back to complete-snapshot validation.
 */
export function notifiesAbsence(
  cached: TtscCachedProjectTransform,
  input: string,
): boolean {
  return trackerProvesInputUnchanged(cached.candidateMutationTracker, input);
}
