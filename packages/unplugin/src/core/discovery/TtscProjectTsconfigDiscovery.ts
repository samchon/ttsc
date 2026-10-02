import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";

/**
 * The selected config and the predicates that selected it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   An ordered candidate list retains rejected ancestors as well as the chosen
 *   file; an undefined file distinguishes an exhausted search from success.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This result couples the selection with its evidence in one readonly record.
 *
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It stores actual observations and declares no fallback project or foreign
 *   mutation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member documentation states nearest-first order and the absent-selection
 *   meaning, with native descriptions retained separately from tags.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Selected and rejected paths retain the filesystem view's native spellings
 *   and predicates; this result does not reinterpret them as URL addresses.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscProjectTsconfigDiscovery only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscProjectTsconfigDiscovery only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscProjectTsconfigDiscovery only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscProjectTsconfigDiscovery {
  /** Every candidate probed, nearest first, including the ones rejected. */
  readonly candidates: readonly TtscProjectTsconfigCandidate[];

  /** The selected config, or `undefined` when no ancestor holds one. */
  readonly file: string | undefined;
}
