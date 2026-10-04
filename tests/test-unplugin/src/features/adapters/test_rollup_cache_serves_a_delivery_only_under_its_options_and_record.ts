import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createRollupCachedModuleProof } from "../../../../../packages/unplugin/src/core/rollup/createRollupCachedModuleProof";
import { selectRollupCachedModuleTransform } from "../../../../../packages/unplugin/src/core/rollup/selectRollupCachedModuleTransform";
import { openHostWatchBridge } from "../../../../../packages/unplugin/src/core/bridge/openHostWatchBridge";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";

/**
 * Verifies Rollup's cache is answered from what a delivery carries in its
 * `meta`: a module is served only while it was compiled under the options the
 * build runs with and its project record still holds the bytes its delivery
 * wrote (samchon/ttsc#1491).
 *
 * Rollup keys a cached module by its source alone, so a module whose types
 * changed, or that another `project`, overlay, or plugin list would compile
 * differently, was served as it was. The adapter's answer to
 * `shouldTransformCachedModule` compares both; a module it cannot prove runs
 * again, and one it does not transform is not its to answer.
 *
 * 1. Deliver a module with its record under one set of options, and assert it is
 *    served; switch the options, and assert it runs again.
 * 2. Deliver a module that consulted no project, and assert it is served under its
 *    options and runs under others.
 * 3. Assert a delivery no cache may serve, a module with no delivery or with a
 *    malformed one, and a delivery whose record is gone all run again, while a
 *    module the adapter does not transform is left to Rollup.
 * 4. Move the record's bytes, open the next build, and assert the module runs
 *    again until a delivery hands the bytes now held.
 * @evidence contracts/testing.md#behavioral-verification
 *   Authored createRollupCachedModuleProof compares delivered options and actual fixture record bytes; selectRollupCachedModuleTransform maps its actual answer and bridge debt to true/null, with callable receiver, short-circuit and error assertions.
 * @evidence contracts/testing.md#independent-expectations
 *   A cached delivery can be served only under the same options and unchanged record bytes; absent proof requires transformation. Node's independent SHA-256 over the authored record literals establishes digest expectations. A CSS module outside the owned target set is left to Rollup. The hook requests transformation for owed delivery or movement and otherwise returns null; an exactly true owed answer must avoid consulting proof, while exceptions retain their identity.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers matching and changed options, delivery without a project, null or missing delivery, malformed and missing record, unowned module, changed bytes across begin, quiet mid-pass observation, independently owed delivery for two modules and adoption of fresh delivered proofs. Hook rows distinguish absent/quiet/owed bridge, exactly true versus a malformed truthy answer, exact module reference, delegated receivers and each owner's exception.
 * @evidence contracts/testing.md#execution-ownership
 *   test_rollup_cache_serves_a_delivery_only_under_its_options_and_record calls createRollupCachedModuleProof.deliver/moved/begin, openHostWatchBridge and the production-used hook selector over temporary records and callable channels. It establishes no installed Rollup host, native watcher acquisition or compiler capture.
 */
export async function test_rollup_cache_serves_a_delivery_only_under_its_options_and_record(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unplugin-rollup-cache-proof-");
  const file = path.join(root, "record.json");
  fs.writeFileSync(file, '{"signal":0}');
  let options = "A";
  const proof = createRollupCachedModuleProof(
    "ttsc-unplugin",
    (id) => id.endsWith(".ts"),
    () => options,
    () => false,
  );
  const digest = createHash("sha256").update('{"signal":0}').digest("hex");
  const ask = (meta?: Record<string, unknown>, id = "main.ts") =>
    proof.moved({ id, ...(meta === undefined ? {} : { meta }) });

  // 1. The options and the record.
  const delivered = proof.deliver({ options: "A", record: { digest, file } });
  proof.begin();
  assert.equal(ask(delivered), false, "a delivery that still holds is served");
  options = "B";
  assert.equal(ask(delivered), true, "one compiled under other options runs");
  options = "A";

  // 2. No project consulted.
  const bare = proof.deliver({ options: "A" });
  assert.equal(ask(bare), false);
  options = "B";
  assert.equal(ask(bare), true);
  options = "A";

  // 3. What nothing proves.
  assert.equal(ask(proof.deliver(null)), true, "a volatile delivery runs");
  assert.equal(ask(), true, "a module with no delivery runs");
  assert.equal(ask({ "ttsc-unplugin": { options: "A", record: 1 } }), true);
  assert.equal(
    ask({
      "ttsc-unplugin": {
        options: "A",
        record: { digest, file: path.join(root, "gone.json") },
      },
    }),
    true,
    "a delivery whose record is gone runs",
  );
  assert.equal(ask(undefined, "main.css"), false, "not the adapter's module");

  // 4. The record moved.
  fs.writeFileSync(file, '{"signal":1}');
  proof.begin();
  assert.equal(ask(delivered), true, "the record's bytes moved since");
  const again = proof.deliver({
    options: "A",
    record: {
      digest: createHash("sha256").update('{"signal":1}').digest("hex"),
      file,
    },
  });
  assert.equal(ask(again), false, "a delivery of the bytes now held is served");

  // A pass observes one record frontier, while each module owns its delivery.
  const second = proof.deliver({
    options: "A",
    record: { digest: createHash("sha256").update('{"signal":1}').digest("hex"), file },
  });
  fs.writeFileSync(file, '{"signal":2}');
  assert.equal(ask(again), false, "quiet mid-pass state uses its recorded frontier");
  proof.begin();
  assert.equal(ask(again), true);
  assert.equal(ask(second, "second.ts"), true);
  const firstFresh = proof.deliver({
    options: "A",
    record: { digest: createHash("sha256").update('{"signal":2}').digest("hex"), file },
  });
  assert.equal(ask(firstFresh), false);
  assert.equal(ask(second, "second.ts"), true, "another module still owes delivery");
  const secondFresh = proof.deliver({
    options: "A",
    record: { digest: createHash("sha256").update('{"signal":2}').digest("hex"), file },
  });
  proof.begin();
  assert.equal(ask(firstFresh), false);
  assert.equal(ask(secondFresh, "second.ts"), false);

  // The shared hook protocol leaves a proven module to the host's cache.
  const module = { id: "main.ts", meta: firstFresh };
  assert.equal(selectRollupCachedModuleTransform(undefined, proof, module), null);
  options = "B";
  assert.equal(selectRollupCachedModuleTransform(undefined, proof, module), true);
  options = "A";
  const bridge = openHostWatchBridge(root, {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  });
  try {
    assert.equal(selectRollupCachedModuleTransform(bridge, proof, module), null);
    const bridgeRecord = path.join(root, "bridge.json");
    writeProjectRecordFile(bridgeRecord, {
      inputs: {},
      membership: null,
      root,
      signal: 0,
      tsconfig: path.join(root, "tsconfig.json"),
    });
    const absent = path.join(root, "absent.d.ts");
    bridge.register(bridgeRecord, [
      {
        file: absent,
        evidence: {
          identity: absent,
          missing: false,
          state: { codec: "predicates", observation: { fileExists: true } },
        },
      },
    ]);
    assert.equal(selectRollupCachedModuleTransform(bridge, proof, module), true);
  } finally {
    bridge.close();
  }

  // These authored channels measure delegation, not native host observations.
  let movedCalls = 0;
  const delegated = {
    moved(received: Parameters<typeof proof.moved>[0]): boolean {
      assert.equal(this, delegated);
      assert.equal(received, module);
      ++movedCalls;
      return false;
    },
  };
  const owed = {
    owes(): boolean {
      assert.equal(this, owed);
      return true;
    },
  };
  assert.equal(selectRollupCachedModuleTransform(owed, delegated, module), true);
  assert.equal(movedCalls, 0, "owed delivery bypasses module judgment");
  assert.equal(
    selectRollupCachedModuleTransform(undefined, delegated, module),
    null,
  );
  assert.equal(movedCalls, 1);
  // A malformed truthy channel answer cannot claim the exactly-true protocol.
  assert.equal(
    selectRollupCachedModuleTransform(
      { owes: () => 1 as unknown as boolean },
      delegated,
      module,
    ),
    null,
  );
  assert.equal(movedCalls, 2);
  const bridgeError = new Error("authored bridge judgment failed");
  assert.throws(
    () => selectRollupCachedModuleTransform(
      { owes: () => { throw bridgeError; } }, delegated, module,
    ),
    (error) => error === bridgeError,
  );
  assert.equal(movedCalls, 2, "a bridge failure does not consult module proof");
  const movedError = new Error("authored module judgment failed");
  const throwing = {
    moved(received: Parameters<typeof proof.moved>[0]): boolean {
      assert.equal(this, throwing);
      assert.equal(received, module);
      throw movedError;
    },
  };
  assert.throws(
    () => selectRollupCachedModuleTransform(undefined, throwing, module),
    (error) => error === movedError,
  );
}
