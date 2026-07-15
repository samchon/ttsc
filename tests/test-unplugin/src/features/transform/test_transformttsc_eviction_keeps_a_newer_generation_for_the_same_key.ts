import { assertStaleEvictionKeepsNewerGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies failed-generation eviction is identity-guarded (#672).
 *
 * Eviction must remove only the exact failed generation, never a newer one that
 * another caller installed under the same key while the failure was resolving.
 * A naive `cache.delete(key)` would drop a valid in-flight replacement and
 * force a redundant recompile (or lose single-flight sharing).
 *
 * 1. Prime a shared cache, then plant a rejected generation under its key.
 * 2. Start the retry (which begins awaiting the rejected generation) and, before
 *    its eviction runs, swap in a newer generation for the same key.
 * 3. Assert the retry still rejects but the newer generation survives in the
 *    cache.
 */
export const test_transformttsc_eviction_keeps_a_newer_generation_for_the_same_key =
  async () => {
    await assertStaleEvictionKeepsNewerGeneration();
  };
