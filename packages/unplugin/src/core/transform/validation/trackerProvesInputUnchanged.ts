import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/**
 * Whether a healthy notification scope proves one exact input unchanged: the
 * tracker is live, its silence is proven, the input is one it watches by name,
 * the watch below which the input lives was proven to deliver, and no event
 * touched the input.
 */
export function trackerProvesInputUnchanged(
  tracker: TtscProjectMutationTracker | undefined,
  input: string,
): boolean {
  if (
    tracker === undefined ||
    tracker.failed ||
    tracker.unverified === true ||
    tracker.changesOmitted
  ) {
    return false;
  }
  if (tracker.contentAuthoritative !== true) return false;
  const absolute = path.resolve(input);
  if (tracker.covered?.has(absolute) !== true) return false;
  // The watch below which the input lives could not prove it delivered, so
  // its silence says nothing about this input (samchon/ttsc#1453).
  for (const directory of tracker.unproven ?? []) {
    if (
      tracker.overlaps?.(absolute, directory) ??
      (pathIsWithin(absolute, directory) || pathIsWithin(directory, absolute))
    ) {
      return false;
    }
  }
  for (const changed of tracker.changes) {
    if (
      tracker.overlaps?.(absolute, changed) ??
      (pathIsWithin(absolute, changed) || pathIsWithin(changed, absolute))
    ) {
      return false;
    }
  }
  return true;
}
