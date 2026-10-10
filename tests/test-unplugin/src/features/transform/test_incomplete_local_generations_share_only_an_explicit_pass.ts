import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { usesPreparedPluginBuildEnvironments } from "../../../../../packages/unplugin/src/core/transform/inputs/preparePluginBuildEnvironments";
import { TtscGenerationProof } from "../../../../../packages/unplugin/src/core/transform/validation/TtscGenerationProof";
import type { TtscTransformHooks } from "../../../../../packages/unplugin/src/core/transform/watch/TtscTransformHooks";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies unavailable observation cannot become persistent cache authority.
 *
 * Coherent consumer data may share its first deliveries in one explicitly
 * nonwatching pass. This is distinct from claiming a complete producer proof.
 *
 * 1. Deliver two modules through the actual coordinator and withdraw both host
 *    caches.
 * 2. Reject repeats, another pass, unknown lifecycle and an unrecorded source.
 * 3. Refuse missing/contradictory capabilities and evict after callback failure.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual coordinator retains one Promise for two literal outputs, invokes withdrawal twice and writes no project record; the action selector evicts repeated, later-pass, incomplete-unadmitted, volatile and changed-source owners. The common admission owner rejects unsupported capability and evicts on callback failure.
 * @evidence contracts/testing.md#independent-expectations Literal output, Promise identity, two withdrawals, zero registrations and capture decisions follow the declared single-pass contract; authored source edits and host flags determine refusals independently of production helpers.
 * @evidence contracts/testing.md#distinguishing-cases Same versus new/absent epoch, first versus repeated/unrecorded source, coherent pass-only versus ordinary incomplete, explicit volatility, supported versus absent/watching/contradictory capabilities and throwing withdrawal delimit each authority.
 * @evidence contracts/testing.md#execution-ownership Discovered source unit supplies handwritten consumer envelopes and native files to real delivery/admission operations. It invokes no compiler, watcher or host; actual Bun compilation counts belong to test_e2e_bun_batch. Finally resets each owned cache.
 */
export async function test_incomplete_local_generations_share_only_an_explicit_pass(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const sibling = path.join(fixture.good.projectRoot, "src/other.ts");
  fs.writeFileSync(sibling, fixture.source);
  const cached = fixture.good;
  cached.result.typescript["src/other.ts"] = fixture.code;
  cached.inputHashes["src/other.ts"] = cached.inputHashes["src/main.ts"]!;
  cached.projectSnapshotComplete = false;
  cached.freshDeliveryOnly = true;
  cached.passDeliveryOnly = true;
  const owner = Promise.resolve(cached);
  let withdrawals = 0;
  let registrations = 0;
  const hooks: TtscTransformHooks = {
    watching: false,
    markVolatile: () => {
      withdrawals++;
    },
    project: {
      watching: false,
      toolDirectory: path.join(cached.projectRoot, ".ttsc"),
      register: () => {
        registrations++;
      },
    },
  };
  const action = (
    file: string,
    epoch: number | null = 1,
    candidate = cached,
  ) => {
    const generation = Promise.resolve(candidate);
    fixture.cache.set(fixture.key, generation);
    return selectCachedGenerationAction({
      cache: fixture.cache,
      cached: candidate,
      generation,
      key: fixture.key,
      file,
      source: fixture.source,
      epoch: epoch === null ? undefined : epoch,
    });
  };
  try {
    fixture.cache.set(fixture.key, owner);
    for (const file of [fixture.file, sibling]) {
      const output = await fixture.api.transformTtsc(
        file,
        fixture.source,
        fixture.options,
        undefined,
        fixture.cache,
        hooks,
      );
      assert.equal(output?.code, fixture.code);
      assert.equal(fixture.cache.get(fixture.key), owner);
    }
    assert.equal(
      withdrawals,
      2,
      "each delivery withdraws once without attempting persistent publication",
    );
    assert.equal(
      registrations,
      0,
      "incomplete output never publishes a persistent record",
    );
    const served = new Set(cached.servedFiles);
    cached.servedFiles?.clear();
    assert.equal(usesPreparedPluginBuildEnvironments(cached.result), false);
    await TtscGenerationProof.prepare(cached, sibling, 1);
    assert.equal(
      usesPreparedPluginBuildEnvironments(cached.result),
      false,
      "a first-delivery pass never enters native preparation (#1712)",
    );
    await TtscGenerationProof.prepare(cached, sibling, 2);
    assert.equal(
      usesPreparedPluginBuildEnvironments(cached.result),
      true,
      "another pass must enter the preparation owner",
    );
    // Restore the served checkpoints earned by the coordinator above.
    cached.servedFiles = served;
    assert.equal(
      action(fixture.file),
      "capture",
      "a repeated module needs another compile",
    );
    assert.equal(fixture.cache.has(fixture.key), false);
    cached.servedFiles?.clear();
    assert.equal(action(sibling, 2), "capture");
    assert.equal(action(sibling, null), "capture");
    assert.equal(
      action(path.join(cached.projectRoot, "src/unrecorded.ts")),
      "capture",
    );
    cached.passDeliveryOnly = false;
    assert.equal(action(sibling), "capture");
    cached.passDeliveryOnly = true;
    assert.equal(
      action(sibling, 1, {
        ...cached,
        result: { ...cached.result, volatile: ["src/other.ts"] },
      }),
      "capture",
    );
    // A distinct result owns an independent immutable volatility index.
    const moved = { ...cached, result: { ...cached.result } };
    fs.writeFileSync(sibling, "changed");
    assert.equal(
      selectCachedGenerationAction({
        cache: fixture.cache,
        cached: moved,
        generation: owner,
        key: fixture.key,
        file: sibling,
        source: "changed",
        epoch: 1,
      }),
      "capture",
    );
    fs.writeFileSync(sibling, fixture.source);
    for (const unsupported of [
      undefined,
      {},
      { watching: false },
      { watching: true, markVolatile: () => {} },
      {
        watching: false,
        markVolatile: () => {},
        project: { ...hooks.project!, watching: true },
      },
    ] as Array<TtscTransformHooks | undefined>) {
      fixture.cache.set(fixture.key, owner);
      assert.throws(
        () =>
          TtscGenerationProof.admitFreshOnly(
            cached,
            fixture.cache,
            fixture.key,
            owner,
            1,
            unsupported,
          ),
        /explicitly nonwatching/,
      );
      assert.equal(fixture.cache.has(fixture.key), false);
    }
    fixture.cache.set(fixture.key, owner);
    const failure = new Error("host cache withdrawal refused");
    assert.throws(
      () =>
        TtscGenerationProof.admitFreshOnly(
          cached,
          fixture.cache,
          fixture.key,
          owner,
          1,
          {
            watching: false,
            markVolatile: () => {
              throw failure;
            },
          },
        ),
      (error) => error === failure,
    );
    assert.equal(fixture.cache.has(fixture.key), false);
    cached.servedFiles?.clear();
    fixture.cache.set(fixture.key, owner);
    await assert.rejects(
      fixture.api.transformTtsc(
        sibling,
        fixture.source,
        fixture.options,
        undefined,
        fixture.cache,
        {
          watching: false,
          markVolatile: () => {},
          addWatchFile: () => {
            throw failure;
          },
        },
      ),
      (error) => error === failure,
    );
    assert.equal(
      fixture.cache.has(fixture.key),
      false,
      "failed watch handoff cannot leave an incomplete owner",
    );
    beginTtscTransformBuild(fixture.cache);
    assert.equal(action(sibling, 2), "capture");
  } finally {
    fixture.dispose();
  }
}
