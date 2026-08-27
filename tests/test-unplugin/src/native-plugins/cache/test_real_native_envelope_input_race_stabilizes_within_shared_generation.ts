import { assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration } from "../../internal/real-native-envelope";

/**
 * Verifies one real compiler-input race stabilizes in a shared generation.
 *
 * Synthetic envelopes pin adversarial protocol states, but this regression must
 * also cross `driver.NewTransformGraph`, the linked native plugin, JSON, and
 * the public unplugin cache. A declaration rewrite during the first plugin pass
 * invalidates that attempt; concurrent module requests share the stable retry.
 *
 * 1. Rewrite one selected declaration during the first linked-plugin pass.
 * 2. Request four sibling modules concurrently through the public cache.
 * 3. Assert two native Programs and reuse of only the complete second result.
 */
export const test_real_native_envelope_input_race_stabilizes_within_shared_generation =
  async () => {
    await assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration();
  };
