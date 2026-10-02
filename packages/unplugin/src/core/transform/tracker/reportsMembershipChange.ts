import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Report whether the project tracker recorded structural invalidation. An
 * admitted rename or unattributed event can set this flag without measuring an
 * actual root-set difference. The narrow consumer rejects reuse on this hint
 * before considering whether notification silence remains authoritative.
 *
 * Host and resolution-candidate trackers cover the union of every module's
 * inputs. Their events remain path witnesses: the requested module's narrow
 * validation decides whether that path is relevant. Promoting one of them to a
 * project-wide verdict would discard a generation when an unreachable external
 * input changes, defeating per-file completeness and doing needless compiles.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Only the project tracker supplies this recorded structural-invalidation
 *   flag; it is not a digest comparison certifying an actual member-set change.
 *   Host/candidate witnesses retain their per-module relevance.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One optional boolean read implements this authority boundary; event
 *   classification and input validation remain in their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The result is based on recorded structural evidence, not an unrelated
 *   tracker's noise or a filename-specific invalidation exception.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate native paragraphs explain the verdict and why other trackers
 *   cannot supply it, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One optional boolean read.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A read of live tracker state, which must be current.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Reads one tracker flag; it reads no filesystem and parses no path.
 */
export function reportsMembershipChange(
  cached: TtscCachedProjectTransform,
): boolean {
  return cached.projectMutationTracker?.membershipChanged === true;
}
