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
 *   The ancestor walker owns path/stat work and populates the ordered list;
 *   this result specifies ordering and optional selection, not an algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Selection callers own later current-state comparisons; this retained
 *   selection record supplies no cross-request freshness authority.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The discovery caller owns ordered candidate storage and selected text;
 *   this result acquires no native handle or independent lifecycle coordinator.
 */
export interface TtscProjectTsconfigDiscovery {
  /** Every candidate probed, nearest first, including the ones rejected. */
  readonly candidates: readonly TtscProjectTsconfigCandidate[];

  /** Selected config, or `undefined` when no ancestor proves a regular config. */
  readonly file: string | undefined;
}
