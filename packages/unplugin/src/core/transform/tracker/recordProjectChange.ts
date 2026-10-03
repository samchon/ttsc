import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";

/** Maximum exact mutation paths kept after a tracker already proved a change. */
const MAX_GENERATION_MUTATION_PATHS = 8;

/**
 * Record a content event without classifying it as a membership change.
 *
 * Eight distinct paths suffice for diagnostics once a change is known; the
 * omitted flag preserves the fact that further paths existed.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A Set distinguishes exact path observations; overflow retains a separate
 *   fact instead of pretending that the retained sample is complete.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This operation owns the bounded diagnostic sample; membership policy
 *   remains in recordProjectMutation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The eight-path diagnostic bound changes retained detail, not whether the
 *   generation is considered mutated; it is not a fixture-dependent cutoff.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc separates content classification from the sample bound and
 *   explains the omitted flag, following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Set membership and insertion use expected constant entry-count work per
 *   event; initial string hashing/comparison can depend on path length.
 *   Retained exact paths never exceed eight.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Repeated exact paths reuse their existing Set entry. A fresh tracker owns
 *   a new generation's sample, so old observations cannot certify new work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The caller-owned tracker retains at most eight path strings plus an
 *   overflow bit for its generation. Path byte length has no additional cap;
 *   this function acquires no handles.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Adds the path string a backend reported to a bounded set as given; no path is parsed or compared.
 */
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
