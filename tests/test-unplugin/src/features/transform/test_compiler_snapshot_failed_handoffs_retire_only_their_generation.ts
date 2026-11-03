import assert from "node:assert/strict";

import { resultFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/resultFilesystem";
import { deliverCachedTransform } from "../../../../../packages/unplugin/src/core/transform/deliverCachedTransform";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a failed snapshot handoff retires its owner without deleting a
 * replacement. A snapshot may share current-pass deliveries only after a
 * successful host handoff.
 *
 * 1. Supply a captured pass-only result to the real delivery coordinator.
 * 2. Throw from cache withdrawal or watch notification, with and without a
 *    replacement.
 * 3. Require the original error and exact-owner eviction policy.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual delivery invokes throwing withdrawal and watch callbacks, propagates their original error, removes the failed current Promise and preserves a replacement installed by the callback.
 * @evidence contracts/testing.md#independent-expectations The authored Error object and Promise identities define the expected propagation and cache contents independently of delivery internals.
 * @evidence contracts/testing.md#distinguishing-cases Early withdrawal and later watch handoff exercise distinct failure points; current and superseded owners distinguish necessary retirement from deleting another delivery's result.
 * @evidence contracts/testing.md#execution-ownership The discovered source unit uses the established handwritten cached-delivery fixture and supported host callbacks with the actual coordinator, without a compiler, native watcher or API replacement. Finally resets each private cache.
 */
export function test_compiler_snapshot_failed_handoffs_retire_only_their_generation(): void {
  for (const phase of ["withdrawal", "watch"] as const)
    for (const replaced of [false, true]) {
      const fixture = createCachedDeliveryUnitFixture();
      try {
        const { good, cache, key, file, source } = fixture;
        good.snapshotDeliveryOnly = true;
        good.passDeliveryOnly = true;
        good.projectSnapshotComplete = false;
        const generation = Promise.resolve(good);
        const successor = Promise.resolve({ ...good });
        cache.set(key, generation);
        const failure = new Error("host snapshot handoff failed");
        const refuse = () => {
          if (replaced) cache.set(key, successor);
          throw failure;
        };
        assert.throws(
          () =>
            deliverCachedTransform({
              cache,
              cached: good,
              generation,
              key,
              epoch: 1,
              file,
              source,
              selection: {
                consulted: [],
                tsconfig: good.tsconfig,
                filesystem: resultFilesystem(good.result),
              },
              hooks:
                phase === "withdrawal"
                  ? { markVolatile: refuse }
                  : { markVolatile: () => {}, addWatchFiles: refuse },
            }),
          (error) => error === failure,
        );
        assert.equal(
          cache.get(key),
          replaced ? successor : undefined,
          `${phase}, replaced=${replaced}`,
        );
      } finally {
        fixture.dispose();
      }
    }
}
