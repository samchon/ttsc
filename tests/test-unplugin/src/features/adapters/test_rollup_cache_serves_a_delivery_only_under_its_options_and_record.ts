import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createRollupCachedModuleProof } from "../../../../../packages/unplugin/src/core/rollup/createRollupCachedModuleProof";

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
 *   Authored createRollupCachedModuleProof compares delivered options and actual fixture record bytes; assertions verify reuse, invalidation, volatility, malformed or missing metadata, and non-owned modules.
 * @evidence contracts/testing.md#independent-expectations
 *   A cached delivery can be served only under the same options and unchanged record bytes; absent proof requires transformation. Node's independent SHA-256 over the authored record literals establishes digest expectations. A CSS module outside the owned target set is left to Rollup.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers matching and changed options, delivery without a project, null or missing delivery, malformed and missing record, unowned module, changed bytes across begin and adoption of a fresh delivered proof.
 * @evidence contracts/testing.md#execution-ownership
 *   test_rollup_cache_serves_a_delivery_only_under_its_options_and_record calls createRollupCachedModuleProof.deliver/moved/begin over a temporary record and captured options; all metadata states belong to this entry, with no Rollup process.
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
}
