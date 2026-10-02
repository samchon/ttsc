import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/**
 * Whether compile-time events overlap a declared input, including an ancestor
 * replacement. Unknown declared scope and dropped events conservatively count
 * as change; no tracker means this helper has no positive event witness.
 *
 * @evidence contracts/common.md#principled-implementation Reported changes use the tracker's actual overlap capability when available, otherwise bidirectional containment catches input or ancestor replacement; omitted events cannot establish silence.
 * @evidence contracts/common.md#clear-and-simple-design This predicate owns declared-scope event selection while backend event collection and path identity remain with the tracker and filesystem helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing event identities remain conservative, and no source extension or bundler-specific path whitelist suppresses a declared-input event.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ancestor overlap, undefined declared scope, omitted events and absent tracker meaning with separated acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Declared keys are anchored through Node native paths; the tracker can supply filesystem-aware overlap, with native containment as fallback rather than a universal lowercase rule.
 * @evidence contracts/performance.md#efficient-algorithms Empty events, omitted evidence and unknown scope return before path-list construction. Otherwise D declared spellings are copied/resolved, then up to C times D overlap comparisons short-circuit on success. Native path text and supplied tracker identity/case/realpath work contribute to each reached comparison; temporary path storage scales with D and its spelling bytes, not bounded event count alone.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This event predicate coordinates no cache or completed computation; the enclosing capture owns shared tracker observations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Tracker acquisition and closure belong to capture; this predicate retains no event history beyond its temporary declared-path array.
 */
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
