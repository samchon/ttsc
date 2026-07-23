import { assertCacheHitsDespiteOutOfWalkOutputKey } from "../../internal/transform-project-cache";

/**
 * Verifies #252: the shared cache accepts out-of-walk compiler output keys.
 * output is keyed outside the project's directory walk.
 *
 * The store-time hash snapshot once overlaid the compiler's output keys, which
 * include `node_modules` declarations the per-module validator never re-hashes.
 * The two snapshots could never match, so the cache missed on every module and
 * the whole project was re-transformed per file — the catastrophic slowdown any
 * project importing a typed dependency hit. This pins that an out-of-walk
 * output key no longer defeats the cache.
 *
 * 1. Create a multi-file project whose fixture transform emits one
 *    `node_modules/**` output key.
 * 2. Run `transformTtsc` over every module sharing one cache.
 * 3. Assert the plugin ran exactly once, not once per module.
 */
export const test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key =
  async () => {
    await assertCacheHitsDespiteOutOfWalkOutputKey();
  };
