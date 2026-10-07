import type { TtscTransformCache } from "../transform/cache/TtscTransformCache";
import { beginTtscTransformBuild } from "../transform/cache/beginTtscTransformBuild";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";

/**
 * Own the started esbuild contexts sharing one transform cache.
 *
 * Every start opens a delivery pass, including repeated starts of one context.
 * Only a started identity can release ownership; the last disposal resets the
 * cache before returning true to let the caller clear and close its bridge.
 * Bridge acquisition, sequence tokens and asynchronous close remain
 * caller-owned.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Weak owner identities count each started context once. Unknown disposal
 *   cannot reset another context's cache; the last known owner resets it.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One weak set and count own registration and final release. The returned
 *   boolean separates cache release from the adapter's bridge cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Uses the actual cache pass and reset operations without changing its entries,
 *   substituting a compiler, or manufacturing notification authority.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes repeated pass starts, counted ownership and
 *   caller-owned bridge effects, following the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Context identities and the borrowed cache are opaque; this operation
 *   chooses no native path, case policy or watch backend.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Weak-set membership avoids scanning contexts. Every start delegates a cache
 *   pass and final disposal delegates reset; their work follows retained cache
 *   entries and resource owners, rather than being constant at this wrapper.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Overlapping started contexts retain the same cache while each start still
 *   opens its own pass. Input validity remains the cache consumer's responsibility.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The controller borrows the cache and weakly retains context identities.
 *   Final known disposal resets cache resources; bridge close and cancellation
 *   of ongoing compilation are not guaranteed by this ownership counter.
 */
export function createEsbuildBuildLifecycle(cache: TtscTransformCache) {
  const owners = new WeakSet<object>();
  let lifecycles = 0;
  return {
    start(owner: object): void {
      if (!owners.has(owner)) {
        owners.add(owner);
        lifecycles += 1;
      }
      beginTtscTransformBuild(cache);
    },
    dispose(owner: object): boolean {
      if (!owners.delete(owner)) return false;
      lifecycles -= 1;
      if (lifecycles !== 0) return false;
      resetTtscTransformCache(cache);
      return true;
    },
  };
}
