import { SHARED_BUILD_TRANSFORM_CACHES } from "./SHARED_BUILD_TRANSFORM_CACHES";
import type { TtscSharedBuildTransformCache } from "./TtscSharedBuildTransformCache";
import { createTransformCacheLease } from "./createTransformCacheLease";
import { createTtscTransformCache } from "./createTtscTransformCache";

/**
 * The process's build-scoped cache for one set of resolved options, created on
 * first use (samchon/ttsc#1396).
 *
 * Final idle release resets the cache and removes this pair from the registry.
 * A surviving adapter can acquire its pair again; it restores the registry
 * entry only when no newer pair already owns that key.
 *
 * @param key A serialization preserving the resolved options' JSON order.
 *
 * @evidence contracts/common.md#principled-implementation Equal serialized options select the same process-local cache and lease, while generation validation still decides whether retained output may be served.
 * @evidence contracts/common.md#clear-and-simple-design Lazy lookup creates one cache/lease pair per configuration rather than adding another compilation or filesystem snapshot layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A configuration match establishes sharing identity only; no target-name exception or synthetic successful output changes compile semantics.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies process scope and the stable options key required from callers.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Lookup and registry hooks use the supplied serialized key without scanning
 *   other configurations; key access carries its text cost. A new key creates
 *   one empty cache, fixed capability table and lease plus one initial idle
 *   timer. Later final idle reclamation delegates N-entry reset and generation
 *   resource cleanup to the lease rather than making that work constant.
 * @evidence contracts/performance.md#reuse-equivalent-work Simultaneously requested configurations share one registered pair; final idle reclamation permits later fresh work, and a surviving adapter restores its pair only when another active pair does not already own that key.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Registry growth follows distinct configuration key text and retained pairs,
 *   without a capacity limit. Initial/final idle callbacks reset unowned pairs
 *   and remove matching registrations; active owners and event-loop delay can
 *   extend retention. Surviving adapters keep their own pair, and old leases
 *   cannot delete a newer registration. Lease timers/probes retain their
 *   documented owners rather than being bounded by this registry's entry count.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   New pairs use the actual host-default filesystem capability table; sharing
 *   does not manufacture another view or infer notification/case authority
 *   from a process-wide key. Generation capture and validation still prove
 *   native identities/inputs, and the lease owns native cleanup delegation.
 */
export function sharedBuildTransformCache(
  key: string,
): TtscSharedBuildTransformCache {
  let entry = SHARED_BUILD_TRANSFORM_CACHES.get(key);
  if (entry === undefined) {
    const cache = createTtscTransformCache();
    const owned: TtscSharedBuildTransformCache = {
      cache,
      lease: createTransformCacheLease(cache, {
        acquire() {
          if (!SHARED_BUILD_TRANSFORM_CACHES.has(key))
            SHARED_BUILD_TRANSFORM_CACHES.set(key, owned);
        },
        idle() {
          if (SHARED_BUILD_TRANSFORM_CACHES.get(key) === owned)
            SHARED_BUILD_TRANSFORM_CACHES.delete(key);
        },
      }),
    };
    entry = owned;
    SHARED_BUILD_TRANSFORM_CACHES.set(key, entry);
    // A factory whose build never starts must not retain an unowned pair
    // forever; the first real acquisition cancels this idle grace.
    entry.lease.release();
  }
  return entry;
}
