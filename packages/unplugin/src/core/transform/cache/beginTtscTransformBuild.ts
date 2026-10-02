import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Open a delivery pass that can share a retained generation's complete proof.
 *
 * The counter update is fixed work. The pass's first delivery still proves the
 * recorded snapshot; later first deliveries reaching source comparison hash
 * their text and may compare disk bytes before sharing that proof. Repeated
 * module deliveries retain their existing validation path.
 *
 * This deliberately retains the cached generation. The pass boundary is a
 * statement about _deliveries_ — each module is requested at most once inside
 * it — not about whether the compiled program is still correct, which the
 * generation's own recorded snapshot answers and which `matchesCachedSource`
 * proves once at the pass's first delivery. Clearing here instead made a host
 * whose `buildStart` repeats recompile the whole project on every rebuild even
 * when no compiler input had changed (samchon/ttsc#1300). Use
 * `resetTtscTransformCache` to actually discard a generation and its watchers.
 *
 * Hosts without a guaranteed pass boundary use persistent validation unless
 * they have another immutable lifecycle. Bun runtime setup, for example,
 * defines one process-scoped module-loading session.
 *
 * @evidence contracts/common.md#principled-implementation Advancing the delivery epoch opens a new proof window without discarding the compiled generation, whose first delivery must still prove its snapshot.
 * @evidence contracts/common.md#clear-and-simple-design One cache-owned counter declares the pass; validation and disposal remain separate operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A pass boundary does not fabricate freshness or clear valid work to hide an invalidation error.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs distinguish delivery epochs from generation validity and identify hosts that lack a guaranteed pass boundary.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The epoch is one number per cache in a WeakMap and is released with the cache; the generations' own resources are released by resetTtscTransformCache.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One counter increment.
 * @evidence contracts/performance.md#reuse-equivalent-work Advancing the epoch instead of discarding the generation is what lets a repeating buildStart reuse its compile after the pass's first delivery proves it.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function beginTtscTransformBuild(
  /** Cache whose next deliveries belong to a newly declared host pass. */
  cache: TtscTransformCache,
): void {
  TRANSFORM_CACHE_EPOCHS.set(
    cache,
    (TRANSFORM_CACHE_EPOCHS.get(cache) ?? 0) + 1,
  );
}
