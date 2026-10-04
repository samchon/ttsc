import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { retainPassVerdict } from "../../../../../packages/unplugin/src/core/transform/cache/retainPassVerdict";
import { replaysTerminalGeneration } from "../../../../../packages/unplugin/src/core/transform/cache/replaysTerminalGeneration";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { TtscUnstableGenerationError } from "../../../../../packages/unplugin/src/core/transform/errors/TtscUnstableGenerationError";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkFailureFingerprint";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/src/core/transform/validation/walkSnapshotComplete";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies retained failures respect their pass and observed input frontier.
 *
 * Failed envelopes and unstable errors are supported consumer inputs, not
 * synthetic compiler attempts. Actual capture retry counts remain E2E.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual retainPassVerdict and replaysTerminalGeneration retain one current failed promise, reject successful/no-pass/replaced retention, replay only its epoch, and share one stable environment confirmation across forty deliveries before observing an actual next-turn edit.
 * @evidence contracts/testing.md#independent-expectations Literal true/false replay results, exact retained error identity and equal read counts after the first confirmation express ownership and turn sharing. Actual source bytes change independently; the real walk supplies comparison inputs rather than the expected verdict.
 * @evidence contracts/testing.md#distinguishing-cases Same pass versus new/undefined pass, failure versus successful missing output, current versus replaced promise, stable versus changed environment and fresh observed recovery are contrasted without inventing a compiler result from the validator.
 * @evidence contracts/testing.md#execution-ownership This named unit calls source functions in process over a native temporary corpus and authored protocol data. setImmediate separates actual comparison turns; no compiler, synthetic Go peer, product host or native notification is run. Both cache owners are reset in finally.
 */
export async function test_terminal_generation_replay_follows_pass_and_input_frontiers(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  let reads = 0;
  const cache = createTtscTransformCache({ readFile: (file) => {
    reads += 1;
    return fs.readFileSync(file);
  } });
  const filesystem = transformFilesystem(cache);
  const root = path.dirname(path.dirname(fixture.file));
  try {
    const promise = Promise.resolve(fixture.good);
    cache.set("failure", promise);
    const failed = { type: "failure" as const, typescript: {}, diagnostics: [] };
    const original = new Error("literal compiler failure");
    const verdict = retainPassVerdict(cache, "failure", promise, 1, failed, original);
    assert.ok(verdict);
    assert.equal(verdict.message, "literal compiler failure");
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, failed, new Error("later")), verdict);
    assert.equal(retainPassVerdict(cache, "failure", promise, undefined, failed, original), undefined);
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, fixture.good.result, original), undefined);
    cache.set("failure", Promise.resolve({ ...fixture.good }));
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, failed, original), undefined);
    const props = { currentFile: fixture.file, currentSource: fixture.source, filesystem };
    assert.equal(replaysTerminalGeneration(verdict, 1, props), true);
    assert.equal(replaysTerminalGeneration(verdict, 2, props), false);
    assert.equal(replaysTerminalGeneration(verdict, undefined, props), false);

    const observe = () => {
      TRANSFORM_RESULT_FILESYSTEM.set(fixture.good.result, filesystem);
      const cached = observeValidationUnitGeneration(root, fixture.good.result);
      cached.deliveryEpoch = 1;
      const identities = envelopeDerivation(cached).identityContext;
      const snapshot = collectProjectInputSnapshot(root, identities, filesystem, undefined, { policy: cached.membershipPolicy });
      cached.projectDirectories = snapshot.projectDirectories;
      return new TtscUnstableGenerationError("literal unstable observation", {
        cached,
        declaredInputs: undefined,
        inputStates: new Map(),
        projectInputHashes: snapshot.hashes,
        projectWalkComplete: walkSnapshotComplete(snapshot, undefined),
        projectWalkFailures: projectWalkFailureFingerprint(snapshot, undefined, root, identities),
      });
    };
    const unstable = observe();
    assert.equal(replaysTerminalGeneration(unstable, 2, props), false, "a new pass grants a fresh attempt");
    assert.equal(replaysTerminalGeneration(unstable, 1, props), true);
    const firstReads = reads;
    for (let delivery = 0; delivery < 40; delivery += 1)
      assert.equal(replaysTerminalGeneration(unstable, 1, props), true);
    assert.equal(reads, firstReads, "one stable environment confirmation serves the current turn");
    await new Promise<void>((resolve) => setImmediate(resolve));
    fs.appendFileSync(fixture.file, "// changed actual input\n");
    assert.equal(replaysTerminalGeneration(unstable, undefined, {
      ...props, currentSource: fs.readFileSync(fixture.file, "utf8"),
    }), false);
    const recovered = observe();
    assert.equal(replaysTerminalGeneration(recovered, 1, {
      ...props, currentSource: fs.readFileSync(fixture.file, "utf8"),
    }), true);
  } finally {
    resetTtscTransformCache(cache);
    fixture.dispose();
  }
}
