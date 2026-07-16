import { assertCacheReplaysWhenExternalInputsUnchanged } from "../../internal/transform-external";

/**
 * Verifies the project cache still replays when external inputs are unchanged.
 *
 * The negative twin of the external-input invalidation case: re-hashing the
 * recorded out-of-walk set on every validation must not evict entries whose
 * inputs did not change, or the cache would degrade into a per-call recompile.
 *
 * 1. Transform a file with a reported external input through one shared cache;
 *    capture the cached generation object.
 * 2. Transform again without touching anything.
 * 3. Assert the same generation object is still cached and the output is
 *    byte-identical.
 */
export const test_transformttsc_replays_the_project_cache_when_external_inputs_are_unchanged =
  async () => {
    await assertCacheReplaysWhenExternalInputsUnchanged();
  };
