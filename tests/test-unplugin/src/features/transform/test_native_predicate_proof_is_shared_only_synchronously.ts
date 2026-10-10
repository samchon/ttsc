import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { TtscGenerationProof } from "../../../../../packages/unplugin/src/core/transform/validation/TtscGenerationProof";
import { nativeInputPredicatesHold } from "../../../../../packages/unplugin/src/core/transform/validation/nativeInputPredicatesHold";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies nested admission shares native replay without retaining freshness.
 *
 * Immutable observation membership and current native verdicts have different
 * owners. A new delivery must see changed bytes even in the same build pass.
 *
 * 1. Replay one native config predicate twice inside one admission transaction.
 * 2. Change its bytes, open a new transaction and require refusal.
 * 3. Restore bytes and reject borrowing another generation's verdict.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual nativeInputPredicatesHold reads config bytes once for two synchronous gates, then reads changed bytes in a fresh transaction and refuses; restoration succeeds and a foreign owner cannot lend its verdict.
 * @evidence contracts/testing.md#independent-expectations Literal config bytes and their SHA-256 establish the producer input; one/two/three native reads and true/false outcomes follow the synchronous lifetime rather than a production counter or expected-output helper.
 * @evidence contracts/testing.md#distinguishing-cases Nested versus fresh transaction, changed/restored bytes, same versus foreign owner and absent transaction distinguish valid sharing from stale positive/negative verdict caching.
 * @evidence contracts/testing.md#execution-ownership Direct source unit uses real fixture bytes and a supported filesystem read counter. No compiler, worker or watcher is substituted or started; finally resets its fixture cache.
 */
export function test_native_predicate_proof_is_shared_only_synchronously(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const file = path.join(fixture.good.projectRoot, "config.json");
  const original = "{}";
  fs.writeFileSync(file, original);
  let reads = 0;
  fixture.good.result.graph = { edges: {}, globals: [], configs: [], inputObservations: {
    "config.json": { nativePredicates: [{ version: 1, kind: "file", scope: "cache",
      digest: createHash("sha256").update(original).digest("hex"),
      realpath: fs.realpathSync.native(file), identityStable: true }] },
  } };
  TRANSFORM_RESULT_FILESYSTEM.set(fixture.good.result, { ...DEFAULT_FILESYSTEM_OPERATIONS,
    readFile(input) { if (input === file) reads++; return DEFAULT_FILESYSTEM_OPERATIONS.readFile(input); },
  });
  try {
    const first = TtscGenerationProof.create(fixture.good, fixture.file, 1);
    assert.equal(nativeInputPredicatesHold(fixture.good, first), true);
    assert.equal(nativeInputPredicatesHold(fixture.good, first), true);
    assert.equal(reads, 1);
    fs.writeFileSync(file, "changed");
    const second = TtscGenerationProof.create(fixture.good, fixture.file, 1);
    assert.equal(nativeInputPredicatesHold(fixture.good, second), false);
    assert.equal(nativeInputPredicatesHold(fixture.good, second), false);
    assert.equal(reads, 2);
    fs.writeFileSync(file, original);
    assert.equal(nativeInputPredicatesHold(fixture.good, TtscGenerationProof.create(fixture.good, fixture.file, 1)), true);
    assert.equal(reads, 3);
    fs.writeFileSync(file, "changed");
    assert.equal(nativeInputPredicatesHold(fixture.good, { cached: { ...fixture.good }, nativePredicates: true }), false);
    assert.equal(reads, 4);
    assert.equal(nativeInputPredicatesHold(fixture.good), false);
    assert.equal(reads, 5);
  } finally { fixture.dispose(); }
}
