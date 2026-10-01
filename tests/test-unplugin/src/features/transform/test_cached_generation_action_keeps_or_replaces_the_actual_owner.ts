import assert from "node:assert/strict";
import fs from "node:fs";

import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies cached delivery serves, retries a replacement or requests capture.
 *
 * The production caller awaits the current Promise and settles notifications
 * before this decision. Valid output stays, volatile or mismatching output is
 * evicted, and identity-guarded eviction must not delete a sibling's Promise.
 *
 * 1. Supply a literal settled-pass generation with independent source hashes.
 * 2. Assert valid serving keeps the exact Promise, while volatility captures.
 * 3. Change actual disk bytes and assert stale proof captures without a sibling.
 * 4. Assert stale-proof eviction keeps an installed sibling and retries.
 *
 * @evidence contracts/testing.md#behavioral-verification Production selectCachedGenerationAction directly used by transformTtsc returns serve/retry/capture and applies identity-guarded eviction; exact cache Promise assertions distinguish losing current or sibling state.
 * @evidence contracts/testing.md#independent-expectations Literal actions, exact Promise identities and independently SHA-256-hashed source specify the oracle. Actual changed file bytes establish mismatch; no native producer or compiler response is substituted.
 * @evidence contracts/testing.md#distinguishing-cases Stable source serves, declared volatility captures, changed source without a sibling captures, and changed source with a newer Promise retries that replacement. Incomplete observation, fresh-only delivery and an unproven no-pass snapshot must also capture; each variant has an independent cache/root disposed in finally.
 * @evidence contracts/testing.md#execution-ownership The named source unit executes the actual synchronous action owner on cheap real config/source fixtures. Handwritten settled-pass inputs test the consumer decision; native producer-to-delivery and rejection/diagnostic recovery remain in the boundary batches.
 */
export function test_cached_generation_action_keeps_or_replaces_the_actual_owner(): void {
  const failures: Error[] = [];
  for (const variant of ["valid", "volatile", "changed", "replaced", "incomplete", "fresh-only", "no-pass"] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    const { cache, key, good, file, source } = fixture;
    const generation = Promise.resolve(good);
    cache.set(key, generation);
    const replacement = Promise.resolve({ ...good });
    try {
      let delivered = source;
      if (variant === "incomplete") good.projectSnapshotComplete = false;
      if (variant === "fresh-only") good.freshDeliveryOnly = true;
      if (variant === "volatile") good.result.volatile = ["src/main.ts"];
      if (variant === "changed" || variant === "replaced") {
        delivered = "export const changed = 2;\n";
        fs.writeFileSync(file, delivered, "utf8");
      }
      if (variant === "replaced") cache.set(key, replacement);
      const action = selectCachedGenerationAction({
        cache,
        cached: good,
        epoch: variant === "no-pass" ? undefined : 1,
        file,
        generation,
        key,
        source: delivered,
      });
      if (variant === "valid") {
        assert.equal(action, "serve");
        assert.equal(cache.get(key), generation);
      } else if (variant === "replaced") {
        assert.equal(action, "retry");
        assert.equal(cache.get(key), replacement);
      } else {
        assert.equal(action, "capture");
        assert.equal(cache.size, 0);
      }
    } catch (error) {
      failures.push(new Error(variant, { cause: error }));
    } finally {
      fixture.dispose();
    }
  }
  if (failures.length !== 0) {
    throw new AggregateError(failures, "Cached generation action variants failed");
  }
}
