import type { TtscRollupDelivery } from "./TtscRollupDelivery";

/**
 * How the adapter answers Rollup's cache for the modules it delivers
 * (`createRollupCachedModuleProof`): each delivery leaves its project record's
 * state in the module's `meta`, and cached-module judgment compares it with the
 * pass's observed record digest. That reused observation is not a fresh
 * filesystem read for every module; a matching record-less delivery has a
 * separate no-project meaning.
 *
 * @evidence contracts/common.md#principled-implementation Delivery metadata preserves compiler-option identity and recorded project state, allowing Rollup's source-only cache to ask whether transformed output still holds.
 * @evidence contracts/common.md#clear-and-simple-design Three operations separate pass reset, delivery recording, and cached-module judgment without exposing record proof internals to the host adapter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Absent or unprovable delivery metadata cannot certify cached output, and the adapter answers only modules it owns.
 * @evidence contracts/common.md#meaningful-documentation The interface explains source-only host caching and each method's pass, metadata, or invalidation responsibility.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Typed deliveries carry native project-record filenames and separate option
 *   identities/digests. The interface preserves that boundary without turning
 *   host module ids or metadata keys into normalized physical identities.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The interface defines pass/delivery/judgment capabilities; native proof and
 *   lookup algorithms are implemented by the returned owner.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The interface implements no sharing coordinator; the owning proof instance
 *   establishes the per-pass tables and permitted digest observation window.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The returned owner controls pass tables; this capability carrier defines
 *   no independent acquisition or retention implementation.
 */
export interface RollupCachedModuleProof {
  /**
   * Open a build: forget every record proven and read for the last one, since
   * anything may have moved them since.
   *
   * @evidence contracts/common.md#principled-implementation Beginning a pass clears record proofs and digests whose observation window ended with the previous build.
   * @evidence contracts/common.md#clear-and-simple-design The host declares one boundary instead of clearing proof state separately for each module.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A previous pass's unchanged digest cannot stand in for current recorded project state.
   * @evidence contracts/common.md#meaningful-documentation The comment states which observations expire and why they cannot survive a new build unchecked.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of begin is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   */
  begin(): void;

  /**
   * Take what one delivery was handed, and return the `meta` the module carries
   * into Rollup's cache.
   *
   * @param delivery The options the delivery was compiled under and the record
   *   it was handed, or `null` for a delivery no cache may serve.
   * @evidence contracts/common.md#principled-implementation Delivery records the options and record bytes actually handed to that module, or null when no retained output can be proven.
   * @evidence contracts/common.md#clear-and-simple-design The operation returns plain metadata in the host's existing format without another module cache.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A null delivery preserves uncacheability instead of inventing a digest or hiding volatile inputs.
   * @evidence contracts/common.md#meaningful-documentation The native prose and parameter comment distinguish recorded delivery from the explicit no-cache case.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   Delivery preserves native record filename separately from option identity
   *   and digest. The producer supplies its spelling; null and absent record
   *   are different cache meanings, not native absence or alias proof.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of deliver is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of deliver is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of deliver is declared here; the cost belongs to its
   *   implementation.
   */
  deliver(delivery: TtscRollupDelivery): Record<string, TtscRollupDelivery>;

  /**
   * Whether Rollup must transform a module it would otherwise serve from its
   * cache, the answer of `shouldTransformCachedModule`. A module the adapter
   * does not transform is not its to answer.
   *
   * @param module The module as Rollup's cache holds it.
   * @evidence contracts/common.md#principled-implementation The predicate compares current option identity and pass-observed record bytes with delivered metadata; matching record-less delivery follows the separate no-project rule.
   * @evidence contracts/common.md#clear-and-simple-design A boolean answers Rollup's own retransformation hook; the host retains ownership of its module cache.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported metadata requires retransformation, and modules outside the adapter's filter remain the host's responsibility.
   * @evidence contracts/common.md#meaningful-documentation The comment defines the retransformation verdict and the filter's ownership boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   The signature accepts an opaque host module id/meta, not a native record
   *   path policy. Typed record naming belongs to TtscRollupDelivery and actual
   *   native observation belongs to the proof implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of moved is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of moved is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of moved is declared here; the cost belongs to its
   *   implementation.
   */
  moved(module: { id: string; meta?: Record<string, unknown> }): boolean;
}
