/**
 * Minimal structural type for Next.js's `turbopack` configuration block.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Open configuration keys preserve caller settings while rules maps exact
 *   glob spellings to host-owned loader shorthand or conditional collections.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Unknown rule values preserve host shapes without duplicating its full rule schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The type exposes Turbopack's rule boundary rather than private build internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the host block and preserved settings; tag separation
 *   follows documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Rule keys are host glob syntax and values remain opaque host configuration;
 *   this open block does not interpret loader paths or native file identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The wrapper owns rule copying/coverage checks/loader insertion. This map
 *   representation selects none of those processing strategies.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This block provides no equivalence cache; the wrapper owns per-invocation
 *   resolved-loader verdicts and the host owns later rule execution.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returned rule maps are host-owned configuration. Native loader/session
 *   resources are not acquired or released by the map representation.
 */
export type TurbopackLikeConfig = Record<string, unknown> & {
  /** Per-glob loader rules. Other Turbopack settings are preserved untouched. */
  rules?: Record<string, unknown>;
};
