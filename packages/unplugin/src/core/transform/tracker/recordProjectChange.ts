import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";

/** Maximum exact mutation paths kept after a tracker already proved a change. */
const MAX_GENERATION_MUTATION_PATHS = 8;

/** Record a content event without classifying it as a membership change. */
export function recordProjectChange(
  tracker: TtscProjectMutationTracker,
  changed: string,
): void {
  if (tracker.changes.has(changed)) return;
  if (tracker.changes.size < MAX_GENERATION_MUTATION_PATHS) {
    tracker.changes.add(changed);
  } else {
    tracker.changesOmitted = true;
  }
}
