import { assertRealEnvelopeServesSiblingModulesFromOneCompile } from "../../internal/real-native-envelope";

/**
 * Verifies one real compiler-produced envelope serves every sibling module.
 *
 * Synthetic cache fixtures can count their own sidecar runs while drifting from
 * the production graph contract. This case links a no-op observer into ttsc's
 * ordinary utility host, asserts candidate and proof witnesses on the admitted
 * native envelope, and then crosses the public Vite lifecycle.
 *
 * 1. Deliver four modules through persistent and build-scoped core caches.
 * 2. Assert each real envelope contains the candidate-only and realized proofs.
 * 3. Deliver the same project through Vite and require one native invocation in
 *    every arm.
 */
export const test_real_native_envelope_serves_sibling_modules_from_one_compile =
  async () => {
    await assertRealEnvelopeServesSiblingModulesFromOneCompile();
  };
