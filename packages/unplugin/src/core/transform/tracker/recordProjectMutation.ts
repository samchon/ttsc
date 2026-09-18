import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { recordProjectChange } from "./recordProjectChange";

/** Record enough exact mutation evidence without retaining an event stream. */
export function recordProjectMutation(
  tracker: TtscProjectMutationTracker,
  changed: string,
): void {
  tracker.membershipChanged = true;
  recordProjectChange(tracker, changed);
}
