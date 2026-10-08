import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { TestMetroRuntime } from "../../internal/metro-runtime";

/**
 * Retain native requests through persistence and observe current facts on restart.
 *
 * 1. Record all four native kinds outside the project walk and compact them.
 * 2. A fresh Node reader must produce the same key from the retained requests.
 * 3. Each native transition moves the key; mismatching generation evidence
 *    taints a reusable run and old-schema/malformed snapshots withdraw proof.
 * 4. Same-path kind unions and native-admitted volume-root aliases retain all
 *    requested facts in both the immutable baseline and the final key.
 * 5. A failed worker write retains all four requests in recovery storage;
 *    compaction restores them under a new epoch before reuse resumes.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises actual source recorder, compaction, strict persisted parsing, immutable key-baseline comparison and key assembly over owned external paths; one fresh process reads the same persisted population. A regular-file obstruction forces the actual worker recovery route, whose native requests must survive subsequent compaction and affect the restored key.
 * @evidence contracts/testing.md#independent-expectations Authored byte framing establishes native digests and literal kind requests. Key equality and inequality follow unchanged versus changed inputs; expected current hashes are computed independently from authored bytes, never copied from recorded producer digests.
 * @evidence contracts/testing.md#distinguishing-cases Covers cache/watch scope union, every native kind, absent versus created optional input, directory membership, entry-kind replacement, changed raw bytes, stale generation evidence, schema-four migration and malformed kind requests. Same-spelling kind unions run everywhere; distinct volume-root spellings are included only when native realpath admits the same target, without assuming an OS label establishes equality.
 * @evidence contracts/testing.md#execution-ownership The source-loader unit owns isolated root/external directories and one joined Node reader using the same maintained loader. No Metro service, compiler, Go build, installer or normal production emitter runs; the parent retains inputs until child close.
 */
export async function test_native_predicates_survive_snapshot_compaction(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-metro-native-snapshot-");
  const external = TestProject.tmpdir("ttsc-metro-native-external-");
  fs.writeFileSync(path.join(root, "tsconfig.json"), '{"files":[]}');
  const directory = path.join(external, "directory");
  const file = path.join(external, "raw");
  const optional = path.join(external, "optional");
  const entry = path.join(external, "entry");
  fs.mkdirSync(directory);
  fs.writeFileSync(file, "original");
  fs.writeFileSync(entry, "entry");
  const sha = (bytes: string | Buffer): string =>
    createHash("sha256").update(bytes).digest("hex");
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  fingerprint.prepareSnapshot(root);
  const project = fingerprint.resolveProjectView({ projectRoot: root });
  const kinds = [
    [directory, "directory", sha("")],
    [file, "file", sha("original")],
    [optional, "optional-file", sha("missing\0")],
    [entry, "entry", sha("file\0")],
  ] as const;
  const input = (file: string, kind: string, digest: string, scope = "cache") => ({
    file,
    evidence: {
      identity: fs.existsSync(file) ? fs.realpathSync.native(file) : file,
      missing: !fs.existsSync(file),
      state: {
        codec: "predicates",
        observation: { nativePredicates: [{
          version: 1, kind, digest, scope, identityStable: true,
          realpath: fs.existsSync(file) ? fs.realpathSync.native(file) : null,
        }] },
      },
    },
  });
  const recorder = fingerprint.createSnapshotRecorder();
  recorder.recordMany({ project, inputs: kinds.map(([file, kind, digest]) => input(file, kind, digest)) });
  recorder.recordMany({ project, inputs: [input(directory, "directory", sha(""), "watch")] });
  const run = fingerprint.prepareSnapshot(root);
  const key = fingerprint.computeProjectFingerprint({ projectRoot: root, runId: run });
  assert.doesNotMatch(key, /^nonce:/);
  const retained = fingerprint.readSnapshotState(root);
  for (const [file, kind] of kinds) {
    assert.ok(retained.files.includes(file));
    assert.deepEqual(retained.nativePredicates[file], [kind]);
  }
  assert.deepEqual(retained.accessibleEntries, [], "native listings are not compiler listings");
  const main = path.join(root, "node_modules/.cache/ttsc-metro/graph-inputs.json");
  const baseline = JSON.parse(fs.readFileSync(path.join(path.dirname(main), `key-baseline-${run}.json`), "utf8"));
  assert.deepEqual(
    Object.values(baseline.inputs)
      .map((input: any) => input.nativePredicates?.directory)
      .filter((input) => input !== undefined),
    [{ digest: sha(""), realpath: fs.realpathSync.native(directory) }],
  );
  const childResult = await new Promise<{ stdout: string; pid: number }>((resolve, reject) => {
    const child = execFile(process.execPath, [
      "--import", pathToFileURL(path.join(TestProject.WORKSPACE_ROOT, "config/register-unit-loader.mjs")).href,
      "--input-type=module", "-e",
      "const f=await import(process.argv[1]); const root=process.argv[2]; console.log(JSON.stringify({state:f.readSnapshotState(root),key:f.computeProjectFingerprint({projectRoot:root})}));",
      pathToFileURL(path.join(TestProject.WORKSPACE_ROOT, "packages/metro/src/core/fingerprint.ts")).href,
      root,
    ], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(`Snapshot reader ${child.pid}: ${stderr}`, { cause: error }));
      else resolve({ stdout, pid: child.pid! });
    });
  });
  assert.notEqual(childResult.pid, process.pid);
  const restarted = JSON.parse(childResult.stdout);
  assert.equal(restarted.key, key);
  assert.deepEqual(restarted.state.nativePredicates, retained.nativePredicates);
  let previous = key;
  for (const mutate of [
    () => fs.writeFileSync(path.join(directory, "new-member"), "member"),
    () => fs.writeFileSync(file, "changed"),
    () => fs.writeFileSync(optional, "present"),
    () => { fs.rmSync(entry); fs.mkdirSync(entry); },
  ]) {
    mutate();
    const current = fingerprint.computeProjectFingerprint({ projectRoot: root });
    assert.doesNotMatch(current, /^nonce:/);
    assert.notEqual(current, previous);
    previous = current;
  }
  const late = fingerprint.createSnapshotRecorder(run);
  late.recordMany({ project, inputs: [input(directory, "directory", sha("new-member\0file\0"))] });
  assert.equal(fingerprint.readSnapshotState(root).tainted, true);
  const oldEpoch = retained.id;
  fingerprint.prepareSnapshot(root);
  assert.notEqual(fingerprint.readSnapshotState(root).id, oldEpoch);
  const valid = fs.readFileSync(main, "utf8");
  for (const nativePredicates of [
    { [directory]: ["alien"] },
    { [directory]: [] },
    { [directory]: ["directory", "directory"] },
    { [path.join(external, "unrecorded")]: ["file"] },
  ]) {
    fs.writeFileSync(main, JSON.stringify({ ...JSON.parse(valid), nativePredicates }));
    assert.equal(fingerprint.readSnapshotState(root), undefined);
    assert.match(fingerprint.computeProjectFingerprint({ projectRoot: root }), /^nonce:/);
  }
  fs.writeFileSync(main, valid);
  const legacy = JSON.parse(valid);
  const legacyEpoch = legacy.id;
  legacy.version = 4;
  delete legacy.nativePredicates;
  fs.writeFileSync(main, JSON.stringify(legacy));
  assert.equal(fingerprint.readSnapshotState(root), undefined);
  fingerprint.prepareSnapshot(root);
  const relearned = fingerprint.readSnapshotState(root);
  assert.notEqual(relearned.id, legacyEpoch);
  assert.deepEqual(relearned.nativePredicates, {});

  const aliasDirectory = path.join(external, "aliased-directory");
  fs.mkdirSync(aliasDirectory);
  const volume = path.parse(aliasDirectory).root;
  const spellings = new Set([
    aliasDirectory,
    volume.toUpperCase() + aliasDirectory.slice(volume.length),
    volume.toLowerCase() + aliasDirectory.slice(volume.length),
  ]);
  let member = 0;
  for (const alternate of spellings) {
    if (
      !fs.existsSync(alternate) ||
      fs.realpathSync.native(alternate) !== fs.realpathSync.native(aliasDirectory)
    ) continue;
    const aliasProjectRoot = TestProject.tmpdir("ttsc-metro-native-alias-");
    fs.writeFileSync(path.join(aliasProjectRoot, "tsconfig.json"), '{"files":[]}');
    fingerprint.prepareSnapshot(aliasProjectRoot);
    const aliasProject = fingerprint.resolveProjectView({ projectRoot: aliasProjectRoot });
    const entries = fs.readdirSync(aliasDirectory).sort();
    const digest = sha(entries.map((name) => `${name}\0file\0`).join("\0"));
    fingerprint.createSnapshotRecorder().recordMany({
      project: aliasProject,
      inputs: [
        input(aliasDirectory, "directory", digest),
        input(alternate, "entry", sha("directory\0")),
      ],
    });
    const uncompacted = fingerprint.readSnapshotState(aliasProjectRoot);
    assert.deepEqual(uncompacted.nativePredicates[aliasDirectory],
      alternate === aliasDirectory ? ["directory", "entry"] : ["directory"]);
    const beforeCompaction = fingerprint.computeProjectFingerprint({ projectRoot: aliasProjectRoot });
    assert.doesNotMatch(beforeCompaction, /^nonce:/);
    const aliasRun = fingerprint.prepareSnapshot(aliasProjectRoot);
    const keyed = fingerprint.computeProjectFingerprint({ projectRoot: aliasProjectRoot, runId: aliasRun });
    assert.equal(keyed, beforeCompaction);
    const aliasBaseline = JSON.parse(fs.readFileSync(path.join(
      aliasProjectRoot, "node_modules/.cache/ttsc-metro", `key-baseline-${aliasRun}.json`,
    ), "utf8"));
    const nativeFacts = Object.values(aliasBaseline.inputs)
      .map((value: any) => value.nativePredicates)
      .filter((value) => value !== undefined);
    assert.equal(nativeFacts.length, 1);
    assert.deepEqual(Object.keys(nativeFacts[0]).sort(), ["directory", "entry"]);
    fs.writeFileSync(path.join(aliasDirectory, `member-${++member}`), "member");
    const changed = fingerprint.computeProjectFingerprint({ projectRoot: aliasProjectRoot });
    assert.doesNotMatch(changed, /^nonce:/);
    assert.notEqual(changed, keyed, "every admitted spelling retains directory membership in the key");
  }

  const recoveryRoot = TestProject.tmpdir("ttsc-metro-native-recovery-");
  fs.writeFileSync(path.join(recoveryRoot, "tsconfig.json"), '{"files":[]}');
  fingerprint.prepareSnapshot(recoveryRoot);
  const recoveryProject = fingerprint.resolveProjectView({ projectRoot: recoveryRoot });
  const originalEpoch = fingerprint.readSnapshotState(recoveryRoot).id;
  const recoveryDirectory = path.join(recoveryRoot, "node_modules/.cache/ttsc-metro");
  const aside = `${recoveryDirectory}.aside`;
  const recoverable = [
    input(directory, "directory", sha("new-member\0file\0")),
    input(file, "file", sha("changed")),
    input(optional, "optional-file", sha("file\0present")),
    input(entry, "entry", sha("directory\0")),
  ];
  const expectedRequests = {
    [directory]: ["directory"],
    [file]: ["file"],
    [optional]: ["optional-file"],
    [entry]: ["entry"],
  };
  fs.renameSync(recoveryDirectory, aside);
  try {
    fs.writeFileSync(recoveryDirectory, "obstructed");
    fingerprint.createSnapshotRecorder().recordMany({
      project: recoveryProject,
      inputs: recoverable,
    });
    const recoveryFiles = fs.readdirSync(path.dirname(recoveryDirectory))
      .filter((name) => name.startsWith("ttsc-metro.unhealthy-") && name.endsWith(".json"));
    assert.equal(recoveryFiles.length, 1);
    const recoveredDocument = JSON.parse(fs.readFileSync(path.join(
      path.dirname(recoveryDirectory), recoveryFiles[0]!,
    ), "utf8"));
    assert.deepEqual(recoveredDocument.nativePredicates, expectedRequests);
    assert.equal(fingerprint.readSnapshotState(recoveryRoot), undefined);
  } finally {
    fs.rmSync(recoveryDirectory, { force: true });
    fs.renameSync(aside, recoveryDirectory);
  }
  assert.equal(fingerprint.readSnapshotState(recoveryRoot), undefined);
  fingerprint.prepareSnapshot(recoveryRoot);
  const recoveredState = fingerprint.readSnapshotState(recoveryRoot);
  assert.notEqual(recoveredState.id, originalEpoch);
  assert.deepEqual(recoveredState.nativePredicates, expectedRequests);
  let recoveredKey = fingerprint.computeProjectFingerprint({ projectRoot: recoveryRoot });
  assert.doesNotMatch(recoveredKey, /^nonce:/);
  assert.equal(recoveredKey, fingerprint.computeProjectFingerprint({ projectRoot: recoveryRoot }));
  for (const mutate of [
    () => fs.writeFileSync(path.join(directory, "recovery-member"), "member"),
    () => fs.writeFileSync(file, "recovered-change"),
    () => fs.rmSync(optional),
    () => { fs.rmdirSync(entry); fs.writeFileSync(entry, "returned-file"); },
  ]) {
    mutate();
    const changed = fingerprint.computeProjectFingerprint({ projectRoot: recoveryRoot });
    assert.doesNotMatch(changed, /^nonce:/);
    assert.notEqual(changed, recoveredKey);
    recoveredKey = changed;
  }
}
