import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscCachedProjectTransform } from "../../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

/**
 * Verifies a generation whose watchers may have dropped events stops reading
 * their silence as proof until one delivery proves the recorded state, and then
 * trusts it again (samchon/ttsc#1418).
 *
 * On macOS, libuv re-creates the FSEventStream all of a loop's directory
 * watches share whenever one opens or closes, and events in between are lost.
 * The watch broker reports such a gap, and the tracker is marked unverified
 * rather than failed: it still hears everything after the gap, so one full
 * proof is all the gap costs. Watchers that never report anything stand in for
 * the lost events here, through the cache's `watch` seam.
 *
 * 1. Compile through deaf watchers, mark the trackers unverified, deliver again,
 *    and assert the unchanged generation is kept and trusted again.
 * 2. Add a root file the deaf watchers never report, and assert a trusted
 *    generation cannot see it.
 * 3. Mark the trackers unverified again, deliver, and assert the project
 *    recompiled.
 *
 * @evidence contracts/testing.md#behavioral-verification With deaf watch seams, marking retained trackers unverified must re-prove unchanged state without a new capture and clear their flags. A new source remains unseen while authority is trusted, then a second unverified mark must find it and add one native capture.
 * @evidence contracts/testing.md#independent-expectations Explicitly controlled notification silence and unverified flags establish known proof states independently of real OS timing. Literal capture counts 1,1,1,2 and false flags specify authority withdrawal/recovery; this fixture does not reproduce an actual FSEvents stream gap.
 * @evidence contracts/testing.md#distinguishing-cases Unverified unchanged state, trusted silence despite hidden mutation, and unverified changed state distinguish one full proof from permanent fallback or unconditional trust. Actual backend gaps are outside this seam-based entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_an_unverified_tracker_reproves_the_state_once in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared sidecar artifact supply the real capture and graph. One cache and fixed deaf watches serve every state; only discovered changed membership requires another native invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root/log isolate the hidden appeared.ts. Trackers are taken from the actual generation and marked only at explicit phase boundaries; finally resets the cache. The watch seam owns no native handles, and TestProject owns paths through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_an_unverified_tracker_reproves_the_state_once; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_an_unverified_tracker_reproves_the_state_once(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 1 });
  const cache = api.createTtscTransformCache({
    watch: () => ({ close: () => undefined }),
  });
  const options = api.resolveOptions();
  const module = projectModules(project.root)[0]!;
  const compiles = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = () =>
    api.transformTtsc(
      module,
      fs.readFileSync(module, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: () => undefined },
    );
  const generation = async (): Promise<TtscCachedProjectTransform> =>
    (await [...cache.values()][0]) as TtscCachedProjectTransform;
  const trackers = (cached: TtscCachedProjectTransform) =>
    [
      cached.projectMutationTracker,
      cached.hostInputMutationTracker,
      cached.candidateMutationTracker,
    ].filter((tracker) => tracker !== undefined);
  const markUnverified = async () => {
    const cached = await generation();
    assert.ok(
      trackers(cached).length >= 2,
      "the generation keeps its watchers",
    );
    for (const tracker of trackers(cached)) tracker!.unverified = true;
  };
  try {
    assert.ok(await deliver());
    assert.equal(compiles(), 1);

    await markUnverified();
    assert.ok(await deliver());
    assert.equal(compiles(), 1, "an unchanged state keeps the generation");
    assert.deepEqual(
      trackers(await generation()).map((tracker) => tracker!.unverified),
      trackers(await generation()).map(() => false),
      "one proof lets the watchers vouch for the state again",
    );

    fs.writeFileSync(
      path.join(project.root, "src", "appeared.ts"),
      "export const appeared = 1;\n",
    );
    assert.ok(await deliver());
    assert.equal(
      compiles(),
      1,
      "a trusted watcher that heard nothing proves the program unchanged",
    );

    await markUnverified();
    assert.ok(await deliver());
    assert.equal(
      compiles(),
      2,
      "after a gap, the root file the watchers never reported is found",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
