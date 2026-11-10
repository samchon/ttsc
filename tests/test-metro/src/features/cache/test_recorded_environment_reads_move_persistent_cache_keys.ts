import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "../../internal/metro-runtime";

/**
 * Verifies recorded environment reads participate in Metro's persistent keys.
 *
 * The main process keys output before workers run, so a newly discovered read
 * must also refute a worker's incomplete baseline.
 *
 * 1. Record a value and an absence under a baseline that knew neither name.
 * 2. Compact and compare keys under equal, changed, empty and absent values.
 * 3. Admit a matching worker and refute one whose value differs from its key.
 * 4. Reject malformed environment metadata and retire an older schema.
 *
 * @evidence contracts/testing.md#behavioral-verification Real recorder, compaction and fingerprint operations change keys for recorded reads, retain equality for unread variables, and withdraw reuse after a baseline mismatch.
 * @evidence contracts/testing.md#independent-expectations Literal supplied environments define equal and unequal inputs independently of product hashes; nonce inequality is required when observations do not match the keyed baseline.
 * @evidence contracts/testing.md#distinguishing-cases Covers first discovery, matching workers, changed and unset values, absent versus empty, native case identity, unread variables, plaintext omission, baseline disagreement, corrupt names and digests, and older-schema retirement.
 * @evidence contracts/testing.md#execution-ownership The unit runner loads authored fingerprint code in-process over one temporary project; no Metro host, native compiler or consumer installation runs.
 */
export async function test_recorded_environment_reads_move_persistent_cache_keys(): Promise<void> {
  const api = await TestMetroRuntime.loadFingerprint();
  const root = TestProject.tmpdir("ttsc-metro-environment-");
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"files":["index.ts"]}',
    "index.ts": "export const value = 1;\n",
  });
  const project = api.resolveProjectView({ projectRoot: root });
  const environment = { MODE: "development" };
  const firstRun = api.prepareSnapshot(root);
  const key = (env: NodeJS.ProcessEnv, runId?: string): string =>
    api.computeProjectFingerprint({
      projectRoot: root,
      environment: env,
      runId,
    });
  key(environment, firstRun);
  api.createSnapshotRecorder(firstRun).recordMany({
    inputs: [],
    project,
    environmentInputs: { MODE: "development", UNSET: null },
  });
  assert.equal(api.readSnapshotState(root).tainted, true);
  const secondRun = api.prepareSnapshot(root);
  const stable = key(environment, secondRun);
  assert.equal(key({ ...environment, UNREAD: "changed" }), stable);
  for (const changed of [
    { MODE: "production" },
    {},
    { MODE: "development", UNSET: "" },
  ])
    assert.notEqual(key(changed), stable);
  assert.equal(key(environment), stable);
  if (process.platform === "win32")
    assert.equal(key({ mode: "development" }), stable);
  else {
    assert.notEqual(key({ mode: "development" }), stable);
    assert.equal(key({ ...environment, mode: "different" }), stable);
  }
  const worker = api.createSnapshotRecorder(secondRun);
  worker.recordMany({
    inputs: [],
    project,
    environmentInputs: { MODE: "development", UNSET: null },
  });
  assert.equal(api.readSnapshotState(root).tainted, false);
  assert.equal(key(environment), stable);
  const directory = path.join(root, "node_modules", ".cache", "ttsc-metro");
  for (const file of fs.readdirSync(directory))
    if (file.endsWith(".json"))
      assert.equal(
        fs
          .readFileSync(path.join(directory, file), "utf8")
          .includes("development"),
        false,
        "snapshots and baselines retain no plaintext environment values",
      );
  worker.recordMany({
    inputs: [],
    project,
    environmentInputs: { MODE: "production", UNSET: null },
  });
  assert.equal(api.readSnapshotState(root).tainted, true);
  assert.notEqual(key(environment), key(environment));
  api.prepareSnapshot(root);
  assert.notEqual(key(environment), stable);
  assert.equal(key(environment), key(environment));
  const main = path.join(directory, "graph-inputs.json");
  const previous = JSON.parse(fs.readFileSync(main, "utf8"));
  previous.version = 5;
  delete previous.environment;
  fs.writeFileSync(main, JSON.stringify(previous));
  assert.notEqual(key(environment), key(environment));
  api.prepareSnapshot(root);
  assert.equal(key(environment), key(environment));
  for (const invalid of [
    null,
    ["MODE", "MODE"],
    ["z", "a"],
    [""],
    ["A=B"],
    ["A\x00B"],
  ]) {
    const document = JSON.parse(fs.readFileSync(main, "utf8"));
    document.environment = invalid;
    fs.writeFileSync(main, JSON.stringify(document));
    assert.notEqual(key(environment), key(environment));
    api.prepareSnapshot(root);
    assert.equal(key(environment), key(environment));
  }
  const malformedRun = api.prepareSnapshot(root);
  key(environment, malformedRun);
  const baselineFile = path.join(
    directory,
    `key-baseline-${malformedRun}.json`,
  );
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  baseline.environment = { MODE: "not-a-digest" };
  fs.writeFileSync(baselineFile, JSON.stringify(baseline));
  api.createSnapshotRecorder(malformedRun).recordMany({
    inputs: [],
    project,
    environmentInputs: { MODE: "development" },
  });
  assert.equal(api.readSnapshotState(root).tainted, true);
  assert.notEqual(key(environment), key(environment));
}
