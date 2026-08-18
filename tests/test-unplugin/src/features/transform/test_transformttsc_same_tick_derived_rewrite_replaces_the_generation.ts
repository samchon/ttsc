import { assertSameTickDerivedRewriteReplacesTheGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies a same-tick, same-length rewrite of a derived input replaces the
 * generation.
 *
 * Pins samchon/ttsc#1227 on the narrow validation path. A filesystem stamps a
 * write once per clock tick, so a second same-length write inside the tick that
 * minted an input's recorded stamp leaves its metadata signature unchanged. A
 * signature may therefore be recorded only once the observed filesystem's own
 * clock has provably left that tick; before the fix the capture recorded it
 * anyway and `matchesProvenInput` served the replaced bytes forever.
 *
 * 1. Deliver a project through cache-owned operations that pin every stamp to one
 *    tick, and assert a steady second pass still hits the cache.
 * 2. Rewrite a shared graph global with different bytes of the same length.
 * 3. Assert the next delivery replaces the generation and recompiles once.
 */
export const test_transformttsc_same_tick_derived_rewrite_replaces_the_generation =
  async () => {
    await assertSameTickDerivedRewriteReplacesTheGeneration();
  };
