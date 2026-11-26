import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { WitnessedLoadAnswers } from "../../../../../packages/ttsc/src/plugin/internal/source/WitnessedLoadAnswers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies `WitnessedLoadAnswers.read` shares current native observations
 * within one caller-owned synchronous batch and observes afresh in a new batch
 * or after a witnessed file changes.
 *
 * Multiple plugin/source directories in one synchronous phase often share the
 * same thousands-file GOROOT witness; without a batch observation map, each
 * `WitnessedLoadAnswers.read` re-statted every shared path from scratch.
 *
 * 1. Record two `WitnessedLoadAnswers` entries that both witness the same files.
 * 2. Read both entries in one synchronous batch with a counting observation map
 *    and assert each shared file is observed once (set once, then reused).
 * 3. Mutate one witnessed file and read again in a fresh batch (and without a
 *    batch map); assert both reject the stale record.
 *
 * @evidence contracts/testing.md#behavioral-verification Writes and reads real WitnessedLoadAnswers records over real files in an owned TestProject directory, asserting set/get counts on the supplied batch map and refusal after a real file edit.
 * @evidence contracts/testing.md#independent-expectations Literal answer strings and exact distinct witnessed-path counts follow the two authored files independently of witness signature encoding.
 * @evidence contracts/testing.md#distinguishing-cases Same-batch reuse across two distinct answer identities contrasts with a fresh batch after file mutation and an unbatched call without a shared map.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls WitnessedLoadAnswers and PluginContentIdentities directly over an owned TestProject temporary directory; no Go process, compiler or host runs.
 */
export function test_witnessed_load_answers_shares_observations_within_batch(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-witnessed-batch-"),
  );
  const cache = path.join(root, "cache");
  const fileA = path.join(root, "a.txt");
  const fileB = path.join(root, "b.txt");
  fs.writeFileSync(fileA, "alpha\n");
  fs.writeFileSync(fileB, "bravo\n");

  const store = PluginContentIdentities.open({
    projectRoot: root,
    cacheDir: cache,
    env: {},
  });
  assert.ok(store, "store must open for a cache outside sources");

  const witness = new Map<string, string>();
  PluginBuildEnvironmentWitness.add(witness, fileA);
  PluginBuildEnvironmentWitness.add(witness, fileB);
  WitnessedLoadAnswers.write(
    store,
    "test-batch-kind",
    ["dir-1"],
    "v1",
    witness,
  );
  WitnessedLoadAnswers.write(
    store,
    "test-batch-kind",
    ["dir-2"],
    "v2",
    witness,
  );

  let sets = 0;
  let hits = 0;
  const batch = new (class extends Map<string, string> {
    public override get(key: string): string | undefined {
      const value = super.get(key);
      if (value !== undefined) hits += 1;
      return value;
    }

    public override set(key: string, value: string): this {
      sets += 1;
      return super.set(key, value);
    }
  })();

  const accept = (value: unknown): value is string => typeof value === "string";
  const first = WitnessedLoadAnswers.read(
    store,
    "test-batch-kind",
    ["dir-1"],
    accept,
    batch,
  );
  const second = WitnessedLoadAnswers.read(
    store,
    "test-batch-kind",
    ["dir-2"],
    accept,
    batch,
  );

  assert.equal(first?.value, "v1");
  assert.equal(second?.value, "v2");
  assert.equal(
    sets,
    2,
    "two shared witnessed paths must be observed once each across the batch",
  );
  assert.equal(
    hits,
    2,
    "the second record in the batch must reuse both cached path observations",
  );

  // Mutating a witnessed file must invalidate a fresh batch and an unbatched call.
  fs.writeFileSync(fileB, "charlie-changed\n");
  const freshBatch = new Map<string, string>();
  const afterEditBatched = WitnessedLoadAnswers.read(
    store,
    "test-batch-kind",
    ["dir-1"],
    accept,
    freshBatch,
  );
  assert.equal(
    afterEditBatched,
    undefined,
    "a fresh batch must observe the edit and refuse the stale record",
  );
  assert.equal(
    WitnessedLoadAnswers.read(store, "test-batch-kind", ["dir-2"], accept),
    undefined,
    "an unbatched read must refuse the stale record",
  );
}
