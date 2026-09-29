import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Report whether the project walk observed a membership event. This is positive
 * evidence that the program's root set changed, so it outranks the question of
 * whether the notifications still work.
 *
 * Host and resolution-candidate trackers cover the union of every module's
 * inputs. Their events remain path witnesses: the requested module's narrow
 * validation decides whether that path is relevant. Promoting one of them to a
 * project-wide verdict would discard a generation when an unreachable external
 * input changes, defeating per-file completeness and doing needless compiles.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Only the project walk owns the program-root membership verdict; host and
 *   candidate witnesses retain their narrower per-module relevance.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One optional boolean read implements this authority boundary; event
 *   classification and input validation remain in their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The result is based on recorded structural evidence, not an unrelated
 *   tracker's noise or a filename-specific invalidation exception.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate native paragraphs explain the verdict and why other trackers
 *   cannot supply it, following the documentation skill.
 */
export function reportsMembershipChange(
  cached: TtscCachedProjectTransform,
): boolean {
  return cached.projectMutationTracker?.membershipChanged === true;
}
