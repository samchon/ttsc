import assert from "node:assert/strict";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { withdrawTtscTransformGenerations } from "../../../../../packages/unplugin/src/core/transform/cache/withdrawTtscTransformGenerations";
import { TRANSFORM_CACHE_EPOCHS } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_CACHE_EPOCHS";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verify discarding generations preserves the current delivery pass until reset.
 *
 * Pending compilations can finish after withdrawal. Their handles still belong
 * to the removed generation, whereas the pass declaration belongs to the cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual withdrawal and terminal reset operations; cache membership disappears immediately, fulfilled and later-resolved generation handles close, rejected compiles are consumed, and terminal reset removes the delivery epoch.
 * @evidence contracts/testing.md#independent-expectations Literal epoch one then two, zero membership, and exact three handle closures are authored lifecycle expectations. Tracker callbacks are generation-owned input capabilities, not substitutes for the cleanup operation under test.
 * @evidence contracts/testing.md#distinguishing-cases A fulfilled generation contrasts with an unresolved promise and a rejected compile. One close throws, yet both independent remaining handles must release. Withdrawal retains the pass declaration; terminal reset removes it, and repeated reset cannot close a detached handle again.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes authored lifecycle functions in one process over literal generation data and an explicitly controlled pending promise. The shared fixture creates only input files and no compiler, bundled host or installed SDK producer.
 */
export async function test_generation_withdrawal_preserves_the_delivery_epoch(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const cache = fixture.cache;
  const closed: string[] = [];
  const tracker = (name: string, throws = false): TtscProjectMutationTracker => ({
    changes: new Set(), changesOmitted: false, failed: false, membershipChanged: false,
    close: () => { closed.push(name); if (throws) throw new Error("owned close failed"); },
  });
  const fulfilled = { ...fixture.good, projectMutationTracker: tracker("project", true), hostInputMutationTracker: tracker("host") };
  const pending = { ...fixture.good, candidateMutationTracker: tracker("pending") };
  let complete!: (value: TtscCachedProjectTransform) => void;
  const promise = new Promise<TtscCachedProjectTransform>((resolve) => { complete = resolve; });
  cache.set("fulfilled", Promise.resolve(fulfilled));
  cache.set("pending", promise);
  cache.set("rejected", Promise.reject(new Error("compile rejected")));
  try {
    assert.equal(TRANSFORM_CACHE_EPOCHS.get(cache), 1);
    withdrawTtscTransformGenerations(cache);
    assert.equal(cache.size, 0);
    assert.equal(TRANSFORM_CACHE_EPOCHS.get(cache), 1);
    await Promise.resolve();
    assert.deepEqual(closed, ["project", "host"]);
    assert.equal(fulfilled.projectMutationTracker, undefined);
    assert.equal(fulfilled.hostInputMutationTracker, undefined);
    complete(pending);
    await promise;
    assert.deepEqual(closed, ["project", "host", "pending"]);
    assert.equal(pending.candidateMutationTracker, undefined);
    beginTtscTransformBuild(cache);
    assert.equal(TRANSFORM_CACHE_EPOCHS.get(cache), 2);
    resetTtscTransformCache(cache);
    assert.equal(TRANSFORM_CACHE_EPOCHS.has(cache), false);
    resetTtscTransformCache(cache);
    await Promise.resolve();
    assert.deepEqual(closed, ["project", "host", "pending"]);
  } finally {
    complete(pending);
    fixture.dispose();
  }
}
