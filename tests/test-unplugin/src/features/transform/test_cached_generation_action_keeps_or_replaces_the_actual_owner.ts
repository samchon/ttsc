import assert from "node:assert/strict";
import fs from "node:fs";

import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { notifyVolatileDelivery } from "../../../../../packages/unplugin/src/core/transform/watch/notifyVolatileDelivery";
import type { TtscTransformHooks } from "../../../../../packages/unplugin/src/core/transform/watch/TtscTransformHooks";
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
 * @evidence contracts/testing.md#behavioral-verification Production selectCachedGenerationAction directly used by transformTtsc returns serve/retry/capture and applies identity-guarded eviction; exact cache Promise assertions distinguish losing current or sibling state. Actual notifyVolatileDelivery separately marks a declared module, leaves an ordinary module quiet, accepts absent hooks/callbacks, preserves the callback receiver and propagates its exact Error.
 * @evidence contracts/testing.md#independent-expectations Literal actions, exact Promise identities and independently SHA-256-hashed source specify the oracle. Actual changed file bytes establish mismatch; no native producer or compiler response is substituted. Literal one versus zero callback counts follow the authored immutable volatile list; an independently created Error and the exact hooks object establish propagation and receiver expectations.
 * @evidence contracts/testing.md#distinguishing-cases Stable source serves, declared volatility captures, changed source without a sibling captures, and changed source with a newer Promise retries that replacement. Incomplete observation, fresh-only delivery and an unproven no-pass snapshot must also capture; each variant has an independent cache/root disposed in finally. Five separate delivery rows contrast declared/ordinary input, absent hook object, absent callback and a throwing callback without changing declarations between calls.
 * @evidence contracts/testing.md#execution-ownership Unit test: one synchronous function runs selectCachedGenerationAction, the function transformTtsc calls to choose serve, retry or capture, once per variant over a temporary config and source file and a handwritten cached generation. A native producer or compiler is never run, so how a real generation is captured is not covered here. The production-used notification operation is called directly, not reached by a fabricated compiler or cache-injection seam. Its separate direct invocation does not certify transformTtsc capture/notification assembly or native volatile acquisition.
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
  for (const variant of ["volatile", "ordinary", "no-hooks", "no-callback", "throw"] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    const cached = { ...fixture.good, result: { ...fixture.good.result,
      volatile: variant === "ordinary" ? [] : ["src/main.ts"] } };
    let calls = 0;
    const callbackError = new Error("authored volatility callback failure");
    const hooks: TtscTransformHooks = variant === "no-callback" ? {} : {
      markVolatile: function (this: TtscTransformHooks): void {
        assert.equal(this, hooks, "notification preserves the hook receiver");
        calls++;
        if (variant === "throw") throw callbackError;
      },
    };
    try {
      const notify = () => notifyVolatileDelivery(variant === "no-hooks" ? undefined : hooks, cached, fixture.file);
      if (variant === "throw") {
        assert.throws(notify, (error) => error === callbackError);
        assert.equal(calls, 1);
      } else {
        assert.doesNotThrow(notify);
        assert.equal(calls, variant === "volatile" ? 1 : 0);
        assert.doesNotThrow(notify);
        assert.equal(calls, variant === "volatile" ? 2 : 0, "warm declaration reuse does not suppress delivery notification");
      }
      assert.deepEqual(cached.result.volatile, variant === "ordinary" ? [] : ["src/main.ts"]);
    } catch (error) {
      failures.push(new Error("delivery-" + variant, { cause: error }));
    } finally {
      fixture.dispose();
    }
  }
  if (failures.length !== 0) {
    throw new AggregateError(failures, "Cached generation action variants failed");
  }
}
