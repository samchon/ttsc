import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Report whether the generation's live candidate watcher still proves this
 * exact spelling unchanged. Candidates include recorded fileExists:false
 * predicates, which can describe directories as well as absent paths; the
 * caller selects the recorded predicate or missing scalar it wants to reuse.
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
 * @evidence contracts/performance.md#efficient-algorithms
 *   Candidate tracker selection is fixed work, but the proof checks exact
 *   native coverage and scans unproven scopes/events until an overlap. Costs
 *   follow their populations and delegated native identity/path comparisons;
 *   it does not read candidate bytes or enumerate a project here.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Qualified current candidate notifications permit the caller's recorded
 *   unavailable-file state to be reused without a direct probe. Missing
 *   coverage, uncertainty or an
 *   overlapping event withdraws that permission; the verdict is not cached
 *   across tracker changes merely because the supplied path is unchanged.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Borrows the generation's candidate tracker and its identity/proof storage;
 *   those owners control retained maps and handles, without new state here.
 */
export function notifiesAbsence(
  /** Generation owning the separately scoped candidate observer. */
  cached: TtscCachedProjectTransform,
  /**
   * Exact native candidate spelling; physical aliases alone do not grant
   * coverage.
   */
  input: string,
): boolean {
  return trackerProvesInputUnchanged(cached.candidateMutationTracker, input);
}
