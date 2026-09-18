import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/** Whether a healthy notification scope proves one exact input unchanged. */
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
