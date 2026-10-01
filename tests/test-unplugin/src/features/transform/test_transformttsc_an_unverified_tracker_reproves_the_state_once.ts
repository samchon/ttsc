import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies notification gaps require one full proof before silence becomes
 * authority again.
 *
 * Actual tracker constructors own a cache-local silent observer view. Their
 * unverified flags are input state, not a claim that an OS stream dropped an
 * event. Fresh complete proof clears the flags; a later unreported member is
 * discovered only when that authority is withdrawn again.
 *
 * 1. Attach real silent trackers to an observed generation and withdraw trust.
 * 2. Reprove unchanged state and assert the same generation is served.
 * 3. Add a member, withdraw trust again and assert capture evicts the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual tracker constructors and selectCachedGenerationAction preserve an unchanged generation while clearing both unverified flags, retain trusted membership silence after an unreported file appears and request capture when the same trackers become unverified again.
 * @evidence contracts/testing.md#independent-expectations Literal serve/serve/capture decisions follow the independent membership authority contract. The real appeared.ts file changes the recorded directory population, while the explicit silent watcher provider reports no event; flag arrays must be false after actual complete validation.
 * @evidence contracts/testing.md#distinguishing-cases Two real constructed trackers contrast verified and unverified authority over unchanged and changed membership. The positive reproving path must keep the exact Promise; the negative changed-membership path must evict it. The silent provider does not claim native content authority or an OS dropped-event reproduction.
 * @evidence contracts/testing.md#execution-ownership This named source unit runs actual proof and tracker operations over literal consumer generation data without native compilation. Original invocation counts 1/1/1/2 map to three serving decisions then one capture request; test_transformttsc_unavailable_notifications_keep_the_persistent_cache preserves actual coordinator request-to-producer connection, while test_transformttsc_notified_absent_candidate_is_not_reprobed retains actual native generation/healthy observer assembly and coverage.
 */
export async function test_transformttsc_an_unverified_tracker_reproves_the_state_once(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const config = path.join(root, "tsconfig.json");
  const cache = createTtscTransformCache({ watch: () => ({ close: () => undefined }) });
  const filesystem = transformFilesystem(cache);
  const result = {
    ...fixture.good.result,
    graph: { edges: { "src/main.ts": [] }, globals: [], configs: ["tsconfig.json"] },
    hostInputs: [config],
    hostInputHashes: { [config]: createHash("sha256").update(fs.readFileSync(config)).digest("hex") },
    hostInputRealpaths: { [config]: fs.realpathSync.native(config) },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  const cached = observeValidationUnitGeneration(root, result);
  const generation = Promise.resolve(cached);
  cache.set("fixture", generation);
  const trackers = () => [cached.projectMutationTracker, cached.hostInputMutationTracker]
    .filter((tracker) => tracker !== undefined);
  try {
    cached.projectMutationTracker = await createProjectMutationTracker(
      cached.projectDirectories!, new Set([fixture.file]), filesystem, cached.membershipPolicy,
    );
    cached.hostInputMutationTracker = await createHostInputMutationTracker(
      [config], filesystem, new Set([config]), "all", root,
    );
    const decide = () => selectCachedGenerationAction({
      cache, cached, epoch: undefined, file: fixture.file, generation, key: "fixture", source: fixture.source,
    });
    const markUnverified = () => {
      assert.ok(trackers().length >= 2, "the generation keeps its watchers");
      for (const tracker of trackers()) tracker!.unverified = true;
    };
    assert.equal(decide(), "serve");
    markUnverified();
    assert.equal(decide(), "serve", "an unchanged state keeps the generation");
    assert.equal(cache.get("fixture"), generation);
    assert.deepEqual(trackers().map((tracker) => tracker!.unverified), trackers().map(() => false), "one proof lets the watchers vouch for the state again");
    fs.writeFileSync(path.join(root, "src", "appeared.ts"), "export const appeared = 1;\n");
    assert.equal(decide(), "serve", "a trusted watcher that heard nothing proves the program unchanged");
    markUnverified();
    assert.equal(decide(), "capture", "after a gap, the root file the watchers never reported is found");
    assert.equal(cache.size, 0);
  } finally {
    resetTtscTransformCache(cache);
    fixture.dispose();
  }
}
