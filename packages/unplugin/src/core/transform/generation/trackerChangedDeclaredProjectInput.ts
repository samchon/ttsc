import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/** Whether a compile-time content event overlaps any declared project input. */
export function trackerChangedDeclaredProjectInput(
  tracker: TtscProjectMutationTracker | undefined,
  declared: ReadonlySet<string> | undefined,
  projectRoot: string,
): boolean {
  if (tracker === undefined) return false;
  if (tracker.changesOmitted) return true;
  if (tracker.changes.size === 0) return false;
  if (declared === undefined) return true;
  const inputs = [...declared].map((input) => path.resolve(projectRoot, input));
  for (const changed of tracker.changes) {
    if (
      inputs.some(
        (input) =>
          tracker.overlaps?.(input, changed) ??
          (pathIsWithin(input, changed) || pathIsWithin(changed, input)),
      )
    ) {
      return true;
    }
  }
  return false;
}
