import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * Assertions for the reference-graph cache fingerprint (samchon/ttsc#721).
 *
 * Metro evaluates `getCacheKey` once per run and folds it into every file's
 * per-content cache key, so "two runs" are simulated the way Metro produces
 * them: a fresh transformer module instance per run (Metro loads the module
 * once per process), with the on-disk project mutated between runs. A key
 * change between runs is exactly Metro's re-transform trigger; a stable key is
 * exactly its cache reuse.
 */

/** Absolute path of the main snapshot file for a project root. */
function mainSnapshotPath(root: string): string {
  return path.join(
    root,
    "node_modules",
    ".cache",
    "ttsc-metro",
    "graph-inputs.json",
  );
}

/** Absolute path of the snapshot directory for a project root. */
function snapshotDirectory(root: string): string {
  return path.dirname(mainSnapshotPath(root));
}

/** Parent cache directory where failed snapshot writes leave recovery files. */
function snapshotCacheDirectory(root: string): string {
  return path.dirname(snapshotDirectory(root));
}

/** List durable recovery documents left by failed snapshot writes. */
function listSnapshotRecoveryFiles(root: string): string[] {
  const directory = snapshotCacheDirectory(root);
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter(
      (name) =>
        name.startsWith("ttsc-metro.unhealthy-") && name.endsWith(".json"),
    )
    .map((name) => path.join(directory, name));
}

/** Whether chmod can enforce the controlled write failures used below. */
function canEnforceReadOnlyDirectory(): boolean {
  return (
    process.platform !== "win32" &&
    !(typeof process.getuid === "function" && process.getuid() === 0)
  );
}

/** Parse the main snapshot document, failing the test when absent. */
function readMainSnapshot(root: string): {
  files: string[];
  id: string;
  tainted: boolean;
  version: number;
  volatile: boolean;
} {
  return JSON.parse(fs.readFileSync(mainSnapshotPath(root), "utf8"));
}

/** List the per-worker snapshot files currently on disk. */
function listWorkerSnapshots(root: string): string[] {
  const directory = snapshotDirectory(root);
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter(
      (name) =>
        name.startsWith("graph-inputs.worker-") && name.endsWith(".json"),
    )
    .map((name) => path.join(directory, name));
}

/** Union of the `files` arrays across every worker snapshot on disk. */
function workerSnapshotFiles(root: string): string[] {
  const union = new Set<string>();
  for (const file of listWorkerSnapshots(root)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of parsed.files ?? []) {
      union.add(entry);
    }
  }
  return [...union].sort();
}

/** Run `prepareSnapshot` the way `withTtsc` does at config load. */
export async function prepareSnapshot(root: string): Promise<string> {
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  return fingerprint.prepareSnapshot(root);
}

/**
 * Create a plugin-less TypeScript project for fingerprint-only scenarios that
 * must not require the native compiler or a Go toolchain.
 */
export function createBareProject(): string {
  const root = TestProject.tmpdir("ttsc-metro-cache-");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "app.ts"),
    "export const value: number = 1;\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true }, include: ["src"] }),
    "utf8",
  );
  return root;
}

/** Compute one run's cache key: fresh module, Metro-shaped key options. */
async function cacheKeyForRun(
  root: string,
  options: Record<string, unknown> = {},
): Promise<string> {
  return TestMetroRuntime.withTransformerEnv(options, (mod) =>
    mod.getCacheKey({ projectRoot: root }),
  );
}

/**
 * Asserts the cache key is stable across two simulated runs of an unchanged
 * project. The negative twin of every invalidation case below: without it, the
 * fingerprint could "pass" invalidation tests by never letting Metro reuse a
 * cache entry at all.
 */
export async function assertCacheKeyStableAcrossRunsForUnchangedProject(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const first = await cacheKeyForRun(root);
  const second = await cacheKeyForRun(root);
  assert.equal(first.length, 64);
  assert.equal(first, second);
}

/**
 * Asserts editing any project source between runs changes the cache key, even
 * though Metro never re-keys unchanged files itself: the project walk is the
 * fingerprint half that covers in-project type dependencies and configs.
 */
export async function assertCacheKeyChangesWhenProjectSourceChanges(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);
  fs.writeFileSync(
    path.join(root, "src", "app.ts"),
    "export const value: 1 | 2 = 2;\n",
    "utf8",
  );
  const after = await cacheKeyForRun(root);
  assert.notEqual(before, after);
}

/**
 * The issue's two-run acceptance reproduction, in-project direction: a
 * transform whose output depends on another file, the dependency edited between
 * runs, no `--reset-cache` anywhere. The dependent file's content is untouched,
 * so v1's static key would have served the stale run-1 output; the fingerprint
 * re-keys the run and the fresh transform carries the regenerated output.
 */
export async function assertCacheKeyRekeysWhenTransformInputFileChanges(): Promise<void> {
  const root = TestUnpluginProject.createProject({
    plugins: [
      { transform: "./plugin.cjs", name: "fixture", operation: "read-helper" },
    ],
  });
  const helper = path.join(root, "src", "helper.ts");
  fs.writeFileSync(helper, "first\n", "utf8");
  await prepareSnapshot(root);

  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
  };
  const runOne = await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => ({
      key: mod.getCacheKey({ projectRoot: root }) as string,
      result: await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      }),
    }),
  );
  assert.match(runOne.result.ast.src, /PLUGIN:FIRST/);

  fs.writeFileSync(helper, "second\n", "utf8");
  const runTwo = await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => ({
      key: mod.getCacheKey({ projectRoot: root }) as string,
      result: await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      }),
    }),
  );
  assert.notEqual(runTwo.key, runOne.key);
  assert.match(runTwo.result.ast.src, /PLUGIN:SECOND/);
}

/**
 * The two-run acceptance reproduction, out-of-walk direction: the transform
 * depends on a file outside the project root, which no project walk can see.
 * Run 1 records it into the worker snapshot through the derived watch inputs;
 * the next run's key re-hashes the recorded path, so editing only that external
 * file re-keys the run and a fresh transform regenerates the output.
 */
export async function assertCacheKeyChangesWhenRecordedExternalInputChanges(): Promise<void> {
  const shared = TestProject.tmpdir("ttsc-metro-shared-");
  const external = path.join(shared, "helper.ts");
  fs.writeFileSync(external, "first\n", "utf8");

  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external);
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative.split(path.sep).join("/")],
      },
    ],
  };

  await prepareSnapshot(root);
  const runOne = await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.match(runOne.ast.src as string, /PLUGIN:FIRST/);
  // The transform recorded the external input into this worker's snapshot,
  // beside the project's own configuration inputs, which are out of walk too
  // now that the walk hashes only files that could enter the program
  // (samchon/ttsc#1307).
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      external,
      path.join(root, "package.json"),
      path.join(root, "plugin.cjs"),
      path.join(root, "src", "tsconfig.json"),
      path.join(root, "tsconfig.json"),
    ].sort(),
    "exactly the out-of-walk inputs, and never a project source",
  );

  // Next run: withTtsc compacts the worker snapshot into the main file.
  await prepareSnapshot(root);
  assert.deepEqual(listWorkerSnapshots(root), []);
  assert.ok(readMainSnapshot(root).files.includes(external));
  const before = await cacheKeyForRun(root, options);

  fs.writeFileSync(external, "second\n", "utf8");
  const after = await cacheKeyForRun(root, options);
  assert.notEqual(before, after);
  const runThree = await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.match(runThree.ast.src as string, /PLUGIN:SECOND/);
}

/**
 * Asserts a deleted-and-recreated snapshot mints a new epoch: the recorded
 * out-of-walk set of the old epoch is unknown, so its keys must never alias.
 * Guards the residual staleness path of a wiped `node_modules` combined with a
 * retained Metro cache directory in the OS temp dir.
 */
export async function assertCacheKeyChangesWhenSnapshotRecreated(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);
  fs.rmSync(snapshotDirectory(root), { force: true, recursive: true });
  await prepareSnapshot(root);
  const after = await cacheKeyForRun(root);
  assert.notEqual(before, after);
}

/**
 * Asserts that without a readable snapshot the key folds a per-run nonce: two
 * runs never share a key, so an unknown out-of-walk input set can never serve
 * stale output. This is the sound degradation for unwritable cache directories
 * and for transformer use without `withTtsc`.
 */
export async function assertCacheKeyFoldsNonceWithoutReadableSnapshot(): Promise<void> {
  const root = createBareProject();
  const first = await cacheKeyForRun(root);
  const second = await cacheKeyForRun(root);
  assert.equal(first.length, 64);
  assert.notEqual(first, second);
}

/**
 * Asserts a failed worker write cannot leave a readable old main snapshot in
 * charge of cache reuse. The worker persists its pending observation beside the
 * read-only snapshot directory, every key nonces while that recovery file
 * exists, and a later successful retry plus compaction restores a stable key
 * under a fresh epoch.
 */
export async function assertCacheKeyFoldsNonceAfterSnapshotWriteFailure(): Promise<void> {
  if (!canEnforceReadOnlyDirectory()) {
    return;
  }
  const root = createBareProject();
  const external = path.join(
    TestProject.tmpdir("ttsc-metro-unwritable-worker-"),
    "external.d.ts",
  );
  fs.writeFileSync(external, "declare const recovered: true;\n", "utf8");
  await prepareSnapshot(root);
  const originalIdentity = readMainSnapshot(root).id;
  const originalKey = await cacheKeyForRun(root);
  const { createSnapshotRecorder, resolveProjectView } =
    await TestMetroRuntime.loadFingerprint();
  const recorder = createSnapshotRecorder();
  const project = resolveProjectView({ projectRoot: root });

  fs.chmodSync(snapshotDirectory(root), 0o555);
  try {
    recorder.record({ input: external, project });
    assert.deepEqual(listWorkerSnapshots(root), []);
    assert.equal(listSnapshotRecoveryFiles(root).length, 1);
    assert.notEqual(await cacheKeyForRun(root), await cacheKeyForRun(root));
  } finally {
    fs.chmodSync(snapshotDirectory(root), 0o755);
  }

  // The same observation retries because the failed publication stayed dirty.
  recorder.record({ input: external, project });
  assert.deepEqual(workerSnapshotFiles(root), [external]);
  await prepareSnapshot(root);

  const recovered = readMainSnapshot(root);
  assert.notEqual(recovered.id, originalIdentity);
  assert.ok(recovered.files.includes(external));
  assert.deepEqual(listWorkerSnapshots(root), []);
  assert.deepEqual(listSnapshotRecoveryFiles(root), []);
  const firstRecoveredKey = await cacheKeyForRun(root);
  assert.equal(firstRecoveredKey, await cacheKeyForRun(root));
  assert.notEqual(firstRecoveredKey, originalKey);
}

/**
 * Asserts a failed main-snapshot rewrite follows the same durable degradation:
 * pending worker files remain represented in a recovery document, the old
 * readable main cannot authorize reuse, and recovery compacts under a new id.
 */
export async function assertCacheKeyFoldsNonceAfterSnapshotCompactionFailure(): Promise<void> {
  if (!canEnforceReadOnlyDirectory()) {
    return;
  }
  const root = createBareProject();
  const external = path.join(root, "..", "compaction-input.d.ts");
  await prepareSnapshot(root);
  const originalIdentity = readMainSnapshot(root).id;
  fs.writeFileSync(
    path.join(snapshotDirectory(root), "graph-inputs.worker-test.json"),
    JSON.stringify({
      files: [external],
      tainted: false,
      version: 2,
      volatile: false,
    }),
    "utf8",
  );

  fs.chmodSync(snapshotDirectory(root), 0o555);
  try {
    await prepareSnapshot(root);
    assert.equal(readMainSnapshot(root).id, originalIdentity);
    assert.equal(listSnapshotRecoveryFiles(root).length, 1);
    assert.notEqual(await cacheKeyForRun(root), await cacheKeyForRun(root));
  } finally {
    fs.chmodSync(snapshotDirectory(root), 0o755);
  }

  await prepareSnapshot(root);
  const recovered = readMainSnapshot(root);
  assert.notEqual(recovered.id, originalIdentity);
  assert.ok(recovered.files.includes(external));
  assert.deepEqual(listWorkerSnapshots(root), []);
  assert.deepEqual(listSnapshotRecoveryFiles(root), []);
  assert.equal(await cacheKeyForRun(root), await cacheKeyForRun(root));
}

/**
 * Asserts snapshot maintenance fails closed when neither the primary snapshot
 * directory nor its parent recovery location can accept a write. A reusable
 * worker throws, while preparation transports a non-reusable run token so a
 * later process cannot trust an old main file that becomes readable again.
 */
export async function assertSnapshotFailureWithoutRecoveryStorageFailsClosed(): Promise<void> {
  if (!canEnforceReadOnlyDirectory()) {
    return;
  }
  const root = createBareProject();
  const runId = await prepareSnapshot(root);
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  fingerprint.computeProjectFingerprint({ projectRoot: root, runId });
  const project = fingerprint.resolveProjectView({ projectRoot: root });
  const external = path.resolve(root, "..", "unpersisted-worker-input.d.ts");
  const cacheDirectory = snapshotCacheDirectory(root);
  fs.chmodSync(mainSnapshotPath(root), 0o000);
  fs.chmodSync(snapshotDirectory(root), 0o555);
  fs.chmodSync(cacheDirectory, 0o555);
  let nonReusableRunId: string;
  try {
    assert.throws(
      () =>
        fingerprint.createSnapshotRecorder(runId).record({
          input: external,
          project,
        }),
      {
        message:
          "Unable to persist a Metro snapshot observation or its recovery record.",
        name: "AggregateError",
      },
      "a worker with a run key must fail closed even while the old main snapshot is unreadable",
    );
    nonReusableRunId = await prepareSnapshot(root);
    assert.match(
      nonReusableRunId,
      /^nonce:[a-f0-9]{32}$/,
      "preparation must carry an unpersisted failure across process boundaries",
    );
  } finally {
    fs.chmodSync(cacheDirectory, 0o755);
    fs.chmodSync(snapshotDirectory(root), 0o755);
    fs.chmodSync(mainSnapshotPath(root), 0o644);
  }

  await prepareSnapshot(root);
  assert.deepEqual(listSnapshotRecoveryFiles(root), []);
  assert.notEqual(
    fingerprint.computeProjectFingerprint({
      projectRoot: root,
      runId: nonReusableRunId!,
    }),
    fingerprint.computeProjectFingerprint({
      projectRoot: root,
      runId: nonReusableRunId!,
    }),
    "a non-reusable run token must still force a nonce after the old main snapshot returns",
  );
  assert.equal(await cacheKeyForRun(root), await cacheKeyForRun(root));
}

/**
 * Asserts a volatile marker in the snapshot also degrades the key to a per-run
 * nonce: a plugin-declared volatile output depends on non-file inputs no
 * fingerprint can represent, so Metro must never replay it across runs.
 */
export async function assertCacheKeyFoldsNonceWhileSnapshotVolatile(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  fs.writeFileSync(
    path.join(snapshotDirectory(root), "graph-inputs.worker-test.json"),
    JSON.stringify({ files: [], tainted: false, version: 2, volatile: true }),
    "utf8",
  );
  const first = await cacheKeyForRun(root);
  const second = await cacheKeyForRun(root);
  assert.notEqual(first, second);
}

/**
 * Asserts snapshot compaction: leftover worker files merge into the main
 * snapshot (files unioned, epoch id preserved — compaction is maintenance, not
 * an epoch change) and are deleted afterwards.
 */
export async function assertPrepareSnapshotCompactsWorkerFiles(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const identity = readMainSnapshot(root).id;
  const recorded = path.join(root, "..", "somewhere", "external.d.ts");
  fs.writeFileSync(
    path.join(snapshotDirectory(root), "graph-inputs.worker-test.json"),
    JSON.stringify({
      files: [recorded],
      tainted: false,
      version: 2,
      volatile: false,
    }),
    "utf8",
  );
  const compactionLock = path.join(
    snapshotDirectory(root),
    "snapshot-compaction.lock",
  );
  fs.mkdirSync(compactionLock);
  fs.writeFileSync(
    path.join(compactionLock, "owner.json"),
    JSON.stringify({ pid: process.pid, token: "1".repeat(32) }),
    "utf8",
  );
  try {
    assert.match(
      await prepareSnapshot(root),
      /^nonce:[a-f0-9]{32}$/,
      "a concurrent compactor must force this run onto a private key",
    );
    assert.equal(
      readMainSnapshot(root).id,
      identity,
      "the contender must not rewrite the shared main snapshot",
    );
    assert.equal(
      listWorkerSnapshots(root).length,
      1,
      "the contender must leave the owner's pending worker document intact",
    );
  } finally {
    fs.rmSync(compactionLock, { force: true, recursive: true });
  }

  const exited = spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
  assert.equal(exited.status, 0);
  const staleToken = "2".repeat(32);
  fs.mkdirSync(compactionLock);
  fs.writeFileSync(
    path.join(compactionLock, "owner.json"),
    JSON.stringify({ pid: exited.pid, token: staleToken }),
    "utf8",
  );
  assert.match(
    await prepareSnapshot(root),
    /^nonce:[a-f0-9]{32}$/,
    "the run that discovers a dead compactor must remain private",
  );
  assert.equal(
    fs.existsSync(compactionLock),
    false,
    "a proven dead owner's lock must be moved away from the shared name",
  );
  assert.equal(
    fs.existsSync(
      path.join(
        snapshotDirectory(root),
        `.snapshot-compaction-stale-${staleToken}`,
      ),
    ),
    true,
    "dead-owner recovery must retain an election record for delayed contenders",
  );
  assert.equal(
    listWorkerSnapshots(root).length,
    1,
    "dead-owner recovery must leave compaction to the next run",
  );
  await prepareSnapshot(root);
  const main = readMainSnapshot(root);
  assert.equal(main.id, identity);
  assert.ok(main.files.includes(recorded));
  assert.deepEqual(listWorkerSnapshots(root), []);
}

/**
 * Asserts preparing a snapshot for a nonexistent project root touches nothing:
 * Metro verifies the root exists before running, so such a base can never be a
 * working setup, and `withTtsc` must not materialize directory trees at
 * arbitrary filesystem paths as a side effect.
 */
export async function assertPrepareSnapshotSkipsNonexistentRoot(): Promise<void> {
  const missing = path.join(
    TestProject.tmpdir("ttsc-metro-missing-"),
    "does-not-exist",
  );
  await prepareSnapshot(missing);
  assert.equal(fs.existsSync(missing), false);
}

/**
 * Asserts each malformed snapshot shape independently disables reuse and heals
 * under a fresh epoch. Worker rows cover every serialized field invariant; main
 * and recovery rows prove their distinct parser call paths too.
 */
export async function assertPrepareSnapshotHealsCorruptWorkerFile(): Promise<void> {
  for (const scenario of [
    {
      name: "torn JSON",
      value: (absolute: string) => "{ torn",
    },
    {
      name: "non-string file",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute, 7],
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "non-boolean taint",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute],
          tainted: 0,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "non-boolean volatility",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute],
          tainted: false,
          version: 2,
          volatile: "true",
        }),
    },
    {
      name: "invalid identity",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute],
          id: "not-a-snapshot-identity",
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "legacy version",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute],
          tainted: false,
          version: 1,
          volatile: false,
        }),
    },
    {
      name: "relative file",
      value: () =>
        JSON.stringify({
          files: ["src/app.ts"],
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "duplicate file",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute, absolute],
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "unsorted files",
      value: (absolute: string, secondary: string) =>
        JSON.stringify({
          files: [absolute, secondary].sort().reverse(),
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
    {
      name: "foreign field",
      value: (absolute: string) =>
        JSON.stringify({
          files: [absolute],
          foreign: true,
          tainted: false,
          version: 2,
          volatile: false,
        }),
    },
  ]) {
    const root = createBareProject();
    await prepareSnapshot(root);
    const identity = readMainSnapshot(root).id;
    const corrupt = path.join(
      snapshotDirectory(root),
      "graph-inputs.worker-corrupt.json",
    );
    fs.writeFileSync(
      corrupt,
      scenario.value(
        path.join(root, "src", "app.ts"),
        path.join(root, "src", "secondary.ts"),
      ),
      "utf8",
    );
    assert.notEqual(
      await cacheKeyForRun(root),
      await cacheKeyForRun(root),
      `${scenario.name} worker state must disable reuse by itself`,
    );
    await prepareSnapshot(root);
    assert.equal(
      fs.existsSync(corrupt),
      false,
      `${scenario.name} worker state must be swept`,
    );
    assert.notEqual(
      readMainSnapshot(root).id,
      identity,
      `${scenario.name} worker state must rotate the epoch`,
    );
    assert.equal(
      await cacheKeyForRun(root),
      await cacheKeyForRun(root),
      `${scenario.name} worker state must heal to stable reuse`,
    );
  }

  const mainRoot = createBareProject();
  await prepareSnapshot(mainRoot);
  const mainIdentity = readMainSnapshot(mainRoot).id;
  fs.writeFileSync(
    mainSnapshotPath(mainRoot),
    JSON.stringify({
      files: [],
      id: mainIdentity,
      tainted: "true",
      version: 2,
      volatile: false,
    }),
    "utf8",
  );
  assert.notEqual(
    await cacheKeyForRun(mainRoot),
    await cacheKeyForRun(mainRoot),
    "malformed main state must disable reuse",
  );
  await prepareSnapshot(mainRoot);
  assert.notEqual(readMainSnapshot(mainRoot).id, mainIdentity);
  assert.equal(
    await cacheKeyForRun(mainRoot),
    await cacheKeyForRun(mainRoot),
    "malformed main state must heal to stable reuse",
  );

  const recoveryRoot = createBareProject();
  await prepareSnapshot(recoveryRoot);
  const recoveryIdentity = readMainSnapshot(recoveryRoot).id;
  const recovery = path.join(
    snapshotCacheDirectory(recoveryRoot),
    "ttsc-metro.unhealthy-corrupt.json",
  );
  fs.writeFileSync(
    recovery,
    JSON.stringify({
      files: [path.join(recoveryRoot, "src", "app.ts")],
      tainted: false,
      version: 2,
      volatile: "true",
    }),
    "utf8",
  );
  assert.notEqual(
    await cacheKeyForRun(recoveryRoot),
    await cacheKeyForRun(recoveryRoot),
    "malformed recovery state must disable reuse",
  );
  await prepareSnapshot(recoveryRoot);
  assert.equal(fs.existsSync(recovery), false);
  assert.notEqual(readMainSnapshot(recoveryRoot).id, recoveryIdentity);
  assert.equal(
    await cacheKeyForRun(recoveryRoot),
    await cacheKeyForRun(recoveryRoot),
    "malformed recovery state must heal to stable reuse",
  );
}

/**
 * Asserts the transformer guards every implicit-project dependency against the
 * exact main-process run baseline.
 *
 * The main-process static map is not available to a worker as evidence. A
 * worker that reclassifies from its current filesystem can see a directory link
 * replaced by a real directory after the key was computed and falsely claim
 * that the earlier walk covered its inputs. Generation evidence compared with a
 * run-specific baseline proves static coverage without duplicating normal
 * project inputs, while a mismatch rotates the epoch.
 */
export async function assertTransformerRecordsImplicitDependencyGuards(): Promise<void> {
  const unplugin = await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-metro-shared-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const marker: string;\n", "utf8");

  const root = TestUnpluginProject.createProject({ plugins: [] });
  const inner = path.join(root, "src", "inner.d.ts");
  fs.writeFileSync(inner, "declare const inner: string;\n", "utf8");
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [
          "src/inner.d.ts",
          path.relative(root, external).split(path.sep).join("/"),
        ],
      },
    ],
  };
  const firstRunId = await prepareSnapshot(root);
  await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => {
      mod.getCacheKey({ projectRoot: root });
      await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      });
    },
    firstRunId,
  );
  // The exact set, not a lower bound: the main baseline proves the in-project
  // source and config, while every newly discovered external input is retained.
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      external,
      path.join(root, "package.json"),
      path.join(root, "plugin.cjs"),
    ].sort(),
    "exactly the inputs outside proven static coverage must remain as snapshot guards",
  );
  const firstWorker = JSON.parse(
    fs.readFileSync(listWorkerSnapshots(root)[0]!, "utf8"),
  );
  assert.equal(
    firstWorker.tainted,
    true,
    "newly discovered inputs must rotate the epoch before their first reusable key",
  );
  await prepareSnapshot(root);
  const stabilizedEpoch = readMainSnapshot(root).id;
  const stableRunId = await prepareSnapshot(root);
  await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => {
      mod.getCacheKey({ projectRoot: root });
      await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      });
    },
    stableRunId,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(listWorkerSnapshots(root)[0]!, "utf8")).tainted,
    false,
    "a complete unchanged baseline must stabilize instead of disabling cache reuse",
  );
  await prepareSnapshot(root);
  assert.equal(
    readMainSnapshot(root).id,
    stabilizedEpoch,
    "an unchanged proven run must preserve its snapshot epoch",
  );
  const fingerprint = await TestMetroRuntime.loadFingerprint();

  // The static project map enumerates config candidates at and below Metro's
  // projectRoot, while nearest-config selection can continue above it. Every
  // rejected ancestor candidate belongs in the same run baseline; otherwise a
  // worker correctly reporting that selection path taints every unchanged run.
  const ancestorRoot = createBareProject();
  const ancestorApp = path.join(ancestorRoot, "packages", "app");
  const ancestorSource = path.join(ancestorApp, "src", "index.ts");
  fs.mkdirSync(path.dirname(ancestorSource), { recursive: true });
  fs.writeFileSync(ancestorSource, "export const ancestor = true;\n", "utf8");
  const ancestorRunId = await prepareSnapshot(ancestorApp);
  fingerprint.computeProjectFingerprint({
    projectRoot: ancestorApp,
    runId: ancestorRunId,
  });
  const ancestorProject = fingerprint.resolveProjectView({
    filename: ancestorSource,
    projectRoot: ancestorApp,
  });
  fingerprint.createSnapshotRecorder(ancestorRunId).recordMany({
    inputs: ancestorProject.discoveryInputs,
    project: ancestorProject,
  });
  const ancestorWorker = JSON.parse(
    fs.readFileSync(listWorkerSnapshots(ancestorApp)[0]!, "utf8"),
  );
  assert.equal(
    ancestorWorker.tainted,
    false,
    "unchanged config candidates above projectRoot must match the static run baseline",
  );
  assert.deepEqual(
    ancestorWorker.files,
    [],
    "ancestor discovery inputs already covered by the static key must not enter the durable snapshot",
  );

  // Prove the process boundary itself. The static key sees a linked input, the
  // worker compiles the same bytes after that link becomes a real directory,
  // and the topology returns before the next run. Comparing paths or contents
  // alone aliases A -> B -> A; comparing generation evidence with the exact
  // run baseline taints the worker document and rotates the snapshot epoch.
  const abaRoot = createBareProject();
  const abaTarget = TestProject.tmpdir("ttsc-metro-baseline-target-");
  const abaDirectory = path.join(abaRoot, "linked");
  const abaInput = path.join(abaDirectory, "types.d.ts");
  fs.writeFileSync(
    path.join(abaTarget, "types.d.ts"),
    "declare const aba: true;\n",
    "utf8",
  );
  fs.symlinkSync(
    abaTarget,
    abaDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  await prepareSnapshot(abaRoot);
  const seed = fingerprint.createSnapshotRecorder();
  seed.record({
    input: abaInput,
    project: fingerprint.resolveProjectView({ projectRoot: abaRoot }),
  });
  await prepareSnapshot(abaRoot);
  const originalEpoch = readMainSnapshot(abaRoot).id;
  const runId = await prepareSnapshot(abaRoot);
  const keyedBefore = fingerprint.computeProjectFingerprint({
    projectRoot: abaRoot,
    runId,
  });

  fs.rmSync(abaDirectory, { force: true, recursive: true });
  fs.mkdirSync(abaDirectory);
  fs.writeFileSync(abaInput, "declare const aba: true;\n", "utf8");
  const observed = unplugin.captureWatchInputBaseline(abaInput);
  assert.ok(observed);
  const raced = fingerprint.createSnapshotRecorder(runId);
  raced.recordMany({
    inputs: [
      {
        evidence: {
          identity: observed.identity,
          missing: false,
          state: { codec: "host", hash: observed.hostHash },
        },
        file: abaInput,
      },
    ],
    project: fingerprint.resolveProjectView({
      filename: abaInput,
      projectRoot: abaRoot,
    }),
  });
  const racedDocument = JSON.parse(
    fs.readFileSync(listWorkerSnapshots(abaRoot)[0]!, "utf8"),
  );
  assert.equal(racedDocument.tainted, true);

  fs.rmSync(abaDirectory, { force: true, recursive: true });
  fs.symlinkSync(
    abaTarget,
    abaDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  await prepareSnapshot(abaRoot);
  assert.notEqual(readMainSnapshot(abaRoot).id, originalEpoch);
  assert.notEqual(
    fingerprint.computeProjectFingerprint({ projectRoot: abaRoot }),
    keyedBefore,
    "an ABA topology race must never return to the contaminated static key",
  );

  // The durable snapshot is a mapping from compiler-visible lexical inputs to
  // their selected physical targets, not merely a set of targets. Swapping two
  // targets between two aliases changes module content and identity even
  // though the old physical-identity-to-hash reduction produces the same set.
  const swapRoot = createBareProject();
  const swapTargetA = TestProject.tmpdir("ttsc-metro-swap-target-a-");
  const swapTargetB = TestProject.tmpdir("ttsc-metro-swap-target-b-");
  const swapAliasA = path.join(swapRoot, "linked-a");
  const swapAliasB = path.join(swapRoot, "linked-b");
  const swapInputA = path.join(swapAliasA, "types.d.ts");
  const swapInputB = path.join(swapAliasB, "types.d.ts");
  fs.writeFileSync(
    path.join(swapTargetA, "types.d.ts"),
    'declare const swapped: "a";\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(swapTargetB, "types.d.ts"),
    'declare const swapped: "b";\n',
    "utf8",
  );
  const linkSwapTargets = (left: string, right: string): void => {
    fs.rmSync(swapAliasA, { force: true, recursive: true });
    fs.rmSync(swapAliasB, { force: true, recursive: true });
    fs.symlinkSync(
      left,
      swapAliasA,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.symlinkSync(
      right,
      swapAliasB,
      process.platform === "win32" ? "junction" : "dir",
    );
  };
  linkSwapTargets(swapTargetA, swapTargetB);
  await prepareSnapshot(swapRoot);
  const swapSeed = fingerprint.createSnapshotRecorder();
  const swapProject = fingerprint.resolveProjectView({ projectRoot: swapRoot });
  swapSeed.recordMany({
    inputs: [{ file: swapInputA }, { file: swapInputB }],
    project: swapProject,
  });
  await prepareSnapshot(swapRoot);
  const swapBefore = fingerprint.computeProjectFingerprint({
    projectRoot: swapRoot,
  });
  assert.equal(
    fingerprint.computeProjectFingerprint({ projectRoot: swapRoot }),
    swapBefore,
    "an unchanged lexical-to-physical mapping must keep a stable key",
  );
  linkSwapTargets(swapTargetB, swapTargetA);
  assert.notEqual(
    fingerprint.computeProjectFingerprint({ projectRoot: swapRoot }),
    swapBefore,
    "swapping physical targets between lexical inputs must change the key",
  );

  const selectionRoot = createBareProject();
  const nestedRoot = path.join(selectionRoot, "nested");
  const nestedSource = path.join(nestedRoot, "index.ts");
  const nestedConfig = path.join(nestedRoot, "tsconfig.json");
  fs.mkdirSync(nestedRoot);
  fs.writeFileSync(nestedSource, "export const nested = true;\n", "utf8");
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ include: ["index.ts"] }),
    "utf8",
  );
  await prepareSnapshot(selectionRoot);
  const selectionRunId = await prepareSnapshot(selectionRoot);
  fingerprint.computeProjectFingerprint({
    projectRoot: selectionRoot,
    runId: selectionRunId,
  });
  let nestedConfigSelections = 0;
  const parentSelection = fingerprint.resolveProjectView({
    filename: nestedSource,
    projectDiscoveryFilesystem: {
      stat: (location: string) => {
        if (path.resolve(location) === path.resolve(nestedConfig)) {
          nestedConfigSelections += 1;
          if (nestedConfigSelections === 1) {
            throw new Error("temporarily unavailable");
          }
        }
        return fs.statSync(location);
      },
    },
    projectRoot: selectionRoot,
  });
  assert.equal(
    parentSelection.tsconfig,
    path.join(selectionRoot, "tsconfig.json"),
    "the worker must freeze the parent selected while the nearer config is unavailable",
  );
  assert.equal(
    nestedConfigSelections,
    1,
    "worker evidence must reuse the predicate that selected the project",
  );
  fingerprint.createSnapshotRecorder(selectionRunId).recordMany({
    inputs: parentSelection.discoveryInputs,
    project: parentSelection,
  });
  assert.equal(
    JSON.parse(fs.readFileSync(listWorkerSnapshots(selectionRoot)[0]!, "utf8"))
      .tainted,
    true,
    "a config present in the main key but absent at worker selection must taint even after it returns",
  );

  const corruptRoot = createBareProject();
  const corruptInput = path.join(corruptRoot, "src", "app.ts");
  await prepareSnapshot(corruptRoot);
  const corruptRunId = await prepareSnapshot(corruptRoot);
  fingerprint.computeProjectFingerprint({
    projectRoot: corruptRoot,
    runId: corruptRunId,
  });
  const corruptBaselinePath = path.join(
    snapshotDirectory(corruptRoot),
    `key-baseline-${corruptRunId}.json`,
  );
  const corruptBaseline = JSON.parse(
    fs.readFileSync(corruptBaselinePath, "utf8"),
  ) as { inputs: Record<string, Record<string, unknown>> };
  const observedCorruptInput = unplugin.captureWatchInputBaseline(corruptInput);
  assert.ok(observedCorruptInput);
  const corruptEntry = Object.values(corruptBaseline.inputs).find(
    (entry) => entry.identity === observedCorruptInput.identity,
  );
  assert.ok(corruptEntry);
  corruptEntry.realpath = { ok: true };
  fs.writeFileSync(
    corruptBaselinePath,
    JSON.stringify(corruptBaseline),
    "utf8",
  );
  fingerprint.createSnapshotRecorder(corruptRunId).recordMany({
    inputs: [
      {
        evidence: {
          identity: observedCorruptInput.identity,
          missing: false,
          state: {
            codec: "graph",
            hash: observedCorruptInput.graphHash,
            realpath: null,
          },
        },
        file: corruptInput,
      },
    ],
    project: fingerprint.resolveProjectView({ projectRoot: corruptRoot }),
  });
  const corruptWorker = JSON.parse(
    fs.readFileSync(listWorkerSnapshots(corruptRoot)[0]!, "utf8"),
  );
  assert.deepEqual(
    corruptWorker.files,
    [corruptInput],
    "a corrupt baseline must retain even a statically fingerprinted input",
  );
  assert.equal(
    corruptWorker.tainted,
    true,
    "a corrupt baseline must rotate the snapshot epoch",
  );
}

/**
 * Asserts Metro records an existing linked input because the project walk does
 * not follow the link and therefore cannot fingerprint its target.
 */
export async function assertTransformerRecordsLinkedInput(): Promise<void> {
  const shared = TestProject.tmpdir("ttsc-metro-linked-");
  const target = path.join(shared, "types.d.ts");
  fs.writeFileSync(target, "declare const marker: string;\n", "utf8");

  const root = TestUnpluginProject.createProject({ plugins: [] });
  const linkedDirectory = path.join(root, "linked");
  fs.symlinkSync(
    shared,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = path.join(linkedDirectory, "types.d.ts");
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: {
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "reporter",
          operation: "emit-dependencies",
          dependencies: ["linked/types.d.ts"],
        },
      ],
    },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  // The exact set. The project's own configuration inputs are recorded beside
  // the linked one, because the walk hashes only files that could enter the
  // program and these cannot (samchon/ttsc#1307); a lower bound would let a
  // recorder that swallowed a whole subtree pass.
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      linked,
      path.join(root, "package.json"),
      path.join(root, "plugin.cjs"),
      path.join(root, "src", "tsconfig.json"),
      path.join(root, "tsconfig.json"),
    ].sort(),
    "exactly the out-of-walk inputs, and never a project source",
  );
}

/**
 * Asserts a plugin-declared volatile transform marks this worker's snapshot
 * volatile, feeding the nonce degradation checked by the volatile key case.
 */
export async function assertTransformerRecordsVolatileDeclarations(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: {
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "volatile",
          operation: "emit-volatile",
          volatile: ["src/main.ts"],
        },
      ],
    },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  const workers = listWorkerSnapshots(root);
  assert.equal(workers.length, 1);
  const parsed = JSON.parse(fs.readFileSync(workers[0]!, "utf8"));
  assert.equal(parsed.volatile, true);
}

/**
 * Verifies the two-run resolution-precedence transition inside the project
 * walk. The candidate is absent during run one, so the ordinary project walk
 * cannot hash it; the transform layer still delivers it through addWatchFile,
 * and the recorder must retain that missing path. Creating only that file
 * before run two must therefore change Metro's cache key.
 */
export async function assertCacheKeyChangesWhenSupersedingCandidateAppears(): Promise<void> {
  const root = createBareProject();
  const candidate = path.join(root, "src", "generated.ts");
  const { createSnapshotRecorder, resolveProjectView } =
    await TestMetroRuntime.loadFingerprint();

  await prepareSnapshot(root);
  const firstWorker = createSnapshotRecorder();
  firstWorker.record({
    input: candidate,
    project: resolveProjectView({ projectRoot: root }),
  });
  assert.deepEqual(workerSnapshotFiles(root), [candidate]);

  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);
  fs.writeFileSync(candidate, "export const generated = true;\n", "utf8");
  const after = await cacheKeyForRun(root);
  assert.notEqual(after, before);
}

/**
 * Asserts a clean transformed file records the observation that a previous
 * volatile declaration is gone.
 *
 * The worker recorder used to write only an out-of-walk path or a positive
 * volatile declaration. A later ordinary transform whose graph contribution
 * stayed inside the project walk therefore wrote no worker document, leaving
 * the prior main snapshot's `volatile: true` value sticky forever. This models
 * two fresh Metro workers at the recorder boundary, avoiding an unrelated
 * native compiler invocation while exercising the persisted state transition.
 */
export async function assertCleanTransformClearsVolatileSnapshot(): Promise<void> {
  const root = createBareProject();
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
  };
  const { createSnapshotRecorder, resolveProjectView } =
    await TestMetroRuntime.loadFingerprint();

  await prepareSnapshot(root);
  const volatileWorker = createSnapshotRecorder();
  volatileWorker.recordVolatile({
    project: resolveProjectView({ projectRoot: root }),
  });
  await prepareSnapshot(root);
  assert.equal(readMainSnapshot(root).volatile, true);

  const cleanWorker = createSnapshotRecorder();
  cleanWorker.record({
    input: path.join(root, "src", "app.ts"),
    project: resolveProjectView({ projectRoot: root }),
  });
  await prepareSnapshot(root);

  assert.equal(readMainSnapshot(root).volatile, false);
  assert.equal(
    await cacheKeyForRun(root, options),
    await cacheKeyForRun(root, options),
  );
}

/**
 * Asserts `withTtsc` prepares the snapshot epoch in the config process: the
 * main snapshot exists with a random id before any worker or `getCacheKey`
 * call, which is what keeps unchanged projects on a stable key from the second
 * run onward.
 */
export async function assertWithTtscPreparesTheSnapshot(): Promise<void> {
  const root = createBareProject();
  const { ENV_KEY } = await TestMetroRuntime.loadOptions();
  const { withTtsc } = await TestMetroRuntime.loadIndex();
  const previous = process.env[ENV_KEY];
  try {
    const config = withTtsc({ projectRoot: root, transformer: {} });
    assert.equal(typeof config.transformer.babelTransformerPath, "string");
  } finally {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  }
  const main = readMainSnapshot(root);
  assert.equal(typeof main.id, "string");
  assert.notEqual(main.id.length, 0);
  assert.deepEqual(main.files, []);
}

/**
 * Asserts editing the project's tsconfig re-keys a run that has transformed.
 *
 * The static fingerprint hashes the effective config graph directly, while the
 * worker also retains each config as a derived input and compares its compiler
 * state with the exact run baseline. This transformed-project case proves both
 * routes agree rather than letting either one silently cover a different file.
 */
export async function assertCacheKeyChangesWhenTheTsconfigChanges(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: { upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk() },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  const tsconfig = path.join(root, "tsconfig.json");
  assert.ok(
    workerSnapshotFiles(root).includes(tsconfig),
    "the tsconfig must be recorded, since the walk no longer hashes it",
  );

  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);

  const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions?: Record<string, unknown>;
  };
  parsed.compilerOptions = {
    ...(parsed.compilerOptions ?? {}),
    target: "ES2021",
  };
  fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");

  const after = await cacheKeyForRun(root);
  assert.notEqual(
    before,
    after,
    "a tsconfig edit must re-key every transform in the run",
  );
}

/**
 * Asserts Metro asks the membership policy the way the adapter does.
 *
 * Three differences the previous cycle left between the two packages
 * (samchon/ttsc#1316), all of them the same shape: one product answering one
 * question two ways.
 *
 * The overlay is the one with consequences. It can widen the program through
 * `allowJs`, and path-valued options must replace the inherited `outDir` and
 * `declarationDir` exclusions rather than append to them. The adapter and Metro
 * must derive the same final policy from that effective configuration.
 *
 * The directory stamp and the per-input lookup are cost rather than
 * correctness, and both are measured in the issue.
 */
export async function assertMetroAsksTheAdaptersPolicy(): Promise<void> {
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  const unplugin = await TestUnpluginRuntime.loadUnpluginApi();
  const root = createBareProject();
  const leaf = path.join(root, "tsconfig.json");
  const app = path.join(root, "packages", "app");
  const sourceDirectory = path.join(app, "src");
  const rootConfig = JSON.parse(fs.readFileSync(leaf, "utf8")) as {
    compilerOptions: Record<string, unknown>;
    exclude?: string[];
  };
  rootConfig.exclude = ["packages"];
  fs.writeFileSync(leaf, JSON.stringify(rootConfig), "utf8");
  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.mkdirSync(path.join(app, "tsconfig.json"));
  const adapterProject = unplugin.findNearestProjectTsconfig(sourceDirectory);
  const metroProject = fingerprint.resolveProjectView({ projectRoot: app });
  assert.equal(adapterProject, leaf);
  assert.equal(
    metroProject.policy.sources[0],
    adapterProject,
    "Metro and unplugin must skip the same directory collision and select the same project file",
  );
  const nestedSource = path.join(sourceDirectory, "index.ts");
  fs.writeFileSync(nestedSource, "export const nested = true;\n", "utf8");
  fingerprint.prepareSnapshot(root);
  const beforeNestedProject = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  fs.rmSync(path.join(app, "tsconfig.json"), { recursive: true });
  const nestedConfig = path.join(app, "tsconfig.json");
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({
      compilerOptions: { allowJs: true, outDir: "build" },
      include: ["src"],
    }),
    "utf8",
  );
  assert.notEqual(
    beforeNestedProject,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "a directory becoming a nested config file must change the project map",
  );
  const nestedProject = fingerprint.resolveProjectView({
    filename: nestedSource,
    projectRoot: root,
  });
  assert.equal(
    nestedProject.policy.sources[0],
    nestedConfig,
    "Metro must resolve the recorder project from the transformed file",
  );
  assert.deepEqual(
    nestedProject.roots,
    [app],
    "the nested project must own its routed fingerprint subtree",
  );
  const beforeNestedJavaScript = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  fs.writeFileSync(
    path.join(sourceDirectory, "arrived.js"),
    "export const arrived = true;\n",
    "utf8",
  );
  assert.notEqual(
    beforeNestedJavaScript,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "a source admitted only by the nested config must change the key even below the root project's exclusion",
  );
  const beforeNestedOutput = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  fs.mkdirSync(path.join(app, "build"), { recursive: true });
  fs.writeFileSync(
    path.join(app, "build", "emitted.ts"),
    "export const emitted = true;\n",
    "utf8",
  );
  assert.equal(
    beforeNestedOutput,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "the nested outDir must stay outside every routed project walk",
  );
  const inheritedConfig = path.join(app, "tsconfig.base.json");
  const directConfigKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  fs.writeFileSync(
    inheritedConfig,
    JSON.stringify({
      compilerOptions: { allowJs: true, outDir: "build" },
    }),
    "utf8",
  );
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ extends: "./tsconfig.base.json", include: ["src"] }),
    "utf8",
  );
  const inheritedConfigKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    directConfigKey,
    inheritedConfigKey,
    "changing the nested config's effective ancestry must change the project map",
  );
  const explicitKey = fingerprint.computeProjectFingerprint({
    explicitProject: leaf,
    projectRoot: root,
  });
  fs.writeFileSync(
    inheritedConfig,
    JSON.stringify({
      compilerOptions: {
        allowJs: true,
        outDir: "build",
        target: "ES2022",
      },
    }),
    "utf8",
  );
  const changedAncestryKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    inheritedConfigKey,
    changedAncestryKey,
    "editing an inherited nested config must change the implicit key",
  );
  assert.equal(
    explicitKey,
    fingerprint.computeProjectFingerprint({
      explicitProject: leaf,
      projectRoot: root,
    }),
    "an explicit root project must not join the implicit nested-project map",
  );
  const explicitConfigText = fs.readFileSync(leaf, "utf8");
  const explicitConfig = JSON.parse(explicitConfigText) as {
    compilerOptions?: Record<string, unknown>;
  };
  explicitConfig.compilerOptions = {
    ...(explicitConfig.compilerOptions ?? {}),
    target: "ES2020",
  };
  fs.writeFileSync(leaf, JSON.stringify(explicitConfig), "utf8");
  assert.notEqual(
    explicitKey,
    fingerprint.computeProjectFingerprint({
      explicitProject: leaf,
      projectRoot: root,
    }),
    "an explicit project must fingerprint its config graph before any worker snapshot exists",
  );
  fs.writeFileSync(leaf, explicitConfigText, "utf8");

  fs.rmSync(nestedConfig);
  const missingConfigKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    changedAncestryKey,
    missingConfigKey,
    "removing a nested config file must change the project map",
  );
  assert.equal(
    missingConfigKey,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "a complete project map without the nested config must remain reusable",
  );
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ extends: "./tsconfig.base.json", include: ["src"] }),
    "utf8",
  );
  const appearedConfigKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    missingConfigKey,
    appearedConfigKey,
    "a nested config appearing at an absent candidate must change the project map",
  );
  fs.rmSync(nestedConfig);
  fs.mkdirSync(nestedConfig);
  const directoryConfigKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    appearedConfigKey,
    directoryConfigKey,
    "a nested config file becoming a directory must change the project map",
  );
  fs.rmSync(nestedConfig, { recursive: true });
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ extends: "./tsconfig.base.json", include: ["src"] }),
    "utf8",
  );
  assert.notEqual(
    directoryConfigKey,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "a nested config directory becoming a file must change the project map",
  );
  const incompleteFilesystem = {
    readdir: (location: string) => {
      if (path.resolve(location) === path.resolve(app)) {
        throw new Error("unreadable project subtree");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
    stat: (location: string) => fs.statSync(location),
  };
  assert.notEqual(
    fingerprint.computeProjectFingerprint({
      projectDiscoveryFilesystem: incompleteFilesystem,
      projectRoot: root,
    }),
    fingerprint.computeProjectFingerprint({
      projectDiscoveryFilesystem: incompleteFilesystem,
      projectRoot: root,
    }),
    "an incomplete project-map traversal must produce a nonce instead of a reusable key",
  );
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ extends: "./missing-base.json", include: ["src"] }),
    "utf8",
  );
  assert.notEqual(
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "an incomplete nested config graph must produce a nonce instead of a reusable key",
  );
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({ extends: "./tsconfig.base.json", include: ["src"] }),
    "utf8",
  );

  const sharedProjectRoot = TestProject.tmpdir("ttsc-metro-shared-project-");
  const sharedSource = path.join(sharedProjectRoot, "src", "index.ts");
  const sharedDependency = path.join(sharedProjectRoot, "src", "dependency.ts");
  fs.mkdirSync(path.dirname(sharedSource), { recursive: true });
  fs.writeFileSync(
    path.join(sharedProjectRoot, "tsconfig.json"),
    JSON.stringify({ include: ["src"] }),
    "utf8",
  );
  fs.writeFileSync(sharedSource, "export const shared = true;\n", "utf8");
  fs.writeFileSync(sharedDependency, "export const dependency = 1;\n", "utf8");
  const sharedProject = fingerprint.resolveProjectView({
    filename: sharedSource,
    projectRoot: root,
  });

  const linkedProjectTarget = TestProject.tmpdir("ttsc-metro-linked-project-");
  const linkedProject = path.join(root, "linked-project");
  fs.mkdirSync(path.join(linkedProjectTarget, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(linkedProjectTarget, "tsconfig.json"),
    JSON.stringify({ include: ["src"] }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(linkedProjectTarget, "src", "index.ts"),
    "export const linked = true;\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(linkedProjectTarget, "src", "dependency.ts"),
    "export const dependency = 1;\n",
    "utf8",
  );
  fs.symlinkSync(
    linkedProjectTarget,
    linkedProject,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linkedSource = path.join(linkedProject, "src", "index.ts");
  const linkedDependency = path.join(linkedProject, "src", "dependency.ts");
  const linkedProjectView = fingerprint.resolveProjectView({
    filename: linkedSource,
    projectRoot: root,
  });

  const runId = await prepareSnapshot(root);
  const linkedProjectKey = fingerprint.computeProjectFingerprint({
    projectRoot: root,
    runId,
  });
  assert.ok(
    !linkedProjectKey.startsWith("nonce:"),
    "the linked project map must produce a reusable static key",
  );
  const hostInput = (file: string) => {
    const observed = unplugin.captureWatchInputBaseline(file);
    assert.ok(observed);
    return {
      evidence: {
        identity: observed.identity,
        missing: false,
        state: { codec: "host" as const, hash: observed.hostHash },
      },
      file,
    };
  };
  const externalRecorder = fingerprint.createSnapshotRecorder(runId);
  externalRecorder.recordMany({
    inputs: [...sharedProject.discoveryInputs, hostInput(sharedDependency)],
    project: sharedProject,
  });
  externalRecorder.recordMany({
    inputs: [...linkedProjectView.discoveryInputs, hostInput(linkedDependency)],
    project: linkedProjectView,
  });
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      sharedDependency,
      ...sharedProject.discoveryInputs.map((input: { file: string }) =>
        path.resolve(input.file),
      ),
    ].sort(),
    "out-of-root inputs must remain durable while the linked project is covered by the static map",
  );
  fingerprint.prepareSnapshot(root);
  const beforeSharedEdit = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  const linkedNewSource = path.join(linkedProjectTarget, "src", "new.ts");
  fs.writeFileSync(linkedNewSource, "export const newMember = true;\n", "utf8");
  const afterLinkedAppearance = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    beforeSharedEdit,
    afterLinkedAppearance,
    "a new program member below a linked implicit project must change the static key before a worker runs",
  );
  const nearerSharedConfig = path.join(
    path.dirname(sharedSource),
    "tsconfig.json",
  );
  fs.writeFileSync(
    nearerSharedConfig,
    JSON.stringify({ extends: "../tsconfig.json", include: ["."] }),
    "utf8",
  );
  assert.notEqual(
    beforeSharedEdit,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "a nearer config appearing in an out-of-root watchFolders project must change the key before a worker runs",
  );
  fs.rmSync(nearerSharedConfig);
  fs.writeFileSync(sharedDependency, "export const dependency = 2;\n", "utf8");
  const afterSharedEdit = fingerprint.computeProjectFingerprint({
    projectRoot: root,
  });
  assert.notEqual(
    afterLinkedAppearance,
    afterSharedEdit,
    "editing an out-of-root implicit project's input must change the next key",
  );
  fs.writeFileSync(
    path.join(linkedProjectTarget, "src", "dependency.ts"),
    "export const dependency = 2;\n",
    "utf8",
  );
  assert.notEqual(
    afterSharedEdit,
    fingerprint.computeProjectFingerprint({ projectRoot: root }),
    "editing an input below a project link must change the next key",
  );

  const configured = JSON.parse(fs.readFileSync(leaf, "utf8")) as {
    compilerOptions: Record<string, unknown>;
    exclude?: string[];
  };
  delete configured.exclude;
  configured.compilerOptions.outDir = "src/inherited-output";
  configured.compilerOptions.declarationDir = "src/inherited-declarations";
  fs.writeFileSync(leaf, JSON.stringify(configured), "utf8");

  const strict = fingerprint.resolveProjectView({ projectRoot: root });
  assert.ok(
    !strict.policy.inputExtensions.includes(".js"),
    `a project without allowJs must not admit .js (got ${strict.policy.inputExtensions.join(" ")})`,
  );
  assert.ok(
    strict.policy.excludedDirectories.includes(
      path.join(root, "src", "inherited-output"),
    ),
    "without an overlay Metro must retain the inherited outDir exclusion",
  );
  assert.ok(
    strict.policy.excludedDirectories.includes(
      path.join(root, "src", "inherited-declarations"),
    ),
    "without an overlay Metro must retain the inherited declarationDir exclusion",
  );

  const overlay = {
    allowJs: true,
    declarationDir: "types",
    outDir: "build",
  };
  const widened = fingerprint.resolveProjectView({
    compilerOptions: overlay,
    projectRoot: root,
  });
  assert.ok(
    widened.policy.inputExtensions.includes(".js"),
    "the caller's compiler-options overlay must widen Metro's policy too",
  );
  assert.deepEqual(
    [...widened.policy.excludedDirectories].sort(),
    [path.join(root, "build"), path.join(root, "types")].sort(),
    "Metro must replace inherited output-directory exclusions with the overlay values",
  );
  const adapterPolicy = unplugin.mergeMembershipPolicyOverlay(
    unplugin.readProjectMembershipPolicy(leaf),
    overlay,
    root,
  );
  assert.deepEqual(
    widened.policy,
    adapterPolicy,
    "Metro and the unplugin adapter must resolve the same final membership policy",
  );

  // A directory occupying an `extends` candidate can never be the config, so
  // its children must not change the resolved policy.
  const declared = JSON.parse(fs.readFileSync(leaf, "utf8")) as object;
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./config" }),
    "utf8",
  );
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  const first = fingerprint.resolveProjectView({ projectRoot: root });
  fs.writeFileSync(path.join(root, "config", "note.txt"), "one", "utf8");
  const second = fingerprint.resolveProjectView({ projectRoot: root });
  assert.deepEqual(
    first.policy,
    second.policy,
    "a file inside a directory occupying an extends candidate must not change the policy",
  );

  // The other direction, and the one that makes the first safe to want: the
  // stamp still has to notice a real config arriving at a candidate path.
  // `./config` resolves to `config.json` when that file exists, so its
  // appearance changes the answer and must refresh the memo — a directory
  // contributing its existence instead of its mtime must not blind the stamp
  // to that. Widening `exclude` is what makes the refresh observable rather
  // than merely re-derived.
  fs.writeFileSync(
    path.join(root, "config.json"),
    JSON.stringify({ exclude: ["src/generated"] }),
    "utf8",
  );
  const third = fingerprint.resolveProjectView({ projectRoot: root });
  assert.notDeepEqual(
    second.policy,
    third.policy,
    "a config appearing at an extends candidate must change the policy",
  );
  assert.ok(
    third.policy.excludedDirectories.some((directory: string) =>
      directory.includes("generated"),
    ),
    `the refreshed policy must carry the new config's exclude (got ${JSON.stringify(third.policy.excludedDirectories)})`,
  );

  // And disappearing again, which #1316 asks for beside the appearance. A
  // candidate that stops existing is the same kind of state change as one that
  // starts, so the stamp has to move both ways or a project that deletes a
  // shared config keeps compiling under it.
  fs.rmSync(path.join(root, "config.json"));
  const fourth = fingerprint.resolveProjectView({ projectRoot: root });
  assert.notDeepEqual(
    third.policy,
    fourth.policy,
    "a config disappearing from an extends candidate must change the policy",
  );
  assert.ok(
    !fourth.policy.excludedDirectories.some((directory: string) =>
      directory.includes("generated"),
    ),
    "the refreshed policy must have dropped the deleted config's exclude",
  );
}

/**
 * Asserts the cache key covers a source the caller's compiler-options overlay
 * admits, which is samchon/ttsc#1316's stated acceptance criterion: "Metro's
 * walk admits `.js` exactly as the adapter's does, provable through
 * `getCacheKey` responding to a new `.js` file."
 *
 * Widening the policy object is not enough on its own, and getting only half of
 * it is worse than getting neither. The walk and the recorder are the two
 * halves of one cache key, and they run in different processes, so they agree
 * only by deriving from the same declared options. Hand the overlay to the
 * recorder alone and `isProjectWalkPath` answers that the walk covers an
 * overlay-admitted `.js`, so the recorder drops it from the out-of-walk
 * snapshot while the narrower walk never hashes it: the file is covered by
 * neither half, and Metro serves its dependents' transforms across runs with
 * nothing to notice the edit by.
 *
 * The same scenario also pins path-option replacement. New TypeScript sources
 * under the old declaration directory enter the key after the overlay, while
 * emitted TypeScript under the replacement output directories remains absent.
 * The strict control is what makes the extension positive case meaningful.
 */
export async function assertCacheKeyCoversOverlayAdmittedSources(): Promise<void> {
  const root = createBareProject();
  const tsconfig = path.join(root, "tsconfig.json");
  const configured = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions: Record<string, unknown>;
  };
  configured.compilerOptions.outDir = "src/inherited-output";
  configured.compilerOptions.declarationDir = "src/inherited-declarations";
  fs.writeFileSync(tsconfig, JSON.stringify(configured), "utf8");
  const legacy = path.join(root, "src", "legacy.js");
  fs.writeFileSync(legacy, "export const legacy = 1;\n", "utf8");
  await prepareSnapshot(root);

  const overlay = {
    compilerOptions: {
      allowJs: true,
      declarationDir: "types",
      outDir: "build",
    },
  };
  const before = await cacheKeyForRun(root, overlay);
  fs.writeFileSync(legacy, "export const legacy = 2;\n", "utf8");
  assert.notEqual(
    before,
    await cacheKeyForRun(root, overlay),
    "under allowJs the walk must hash .js sources, so editing one re-keys the run",
  );

  // The criterion's own wording is a *new* `.js` file rather than an edited
  // one, and the two are different questions: an edit changes a file the walk
  // already hashes, while an appearance changes which files the walk hashes at
  // all. Both must move the key under the overlay.
  const appeared = await cacheKeyForRun(root, overlay);
  fs.writeFileSync(
    path.join(root, "src", "arrived.js"),
    "export const arrived = 1;\n",
    "utf8",
  );
  assert.notEqual(
    appeared,
    await cacheKeyForRun(root, overlay),
    "under allowJs a .js the program gains must re-key the run",
  );

  const outputStable = await cacheKeyForRun(root, overlay);
  for (const output of ["build/emitted.ts", "types/emitted.ts"]) {
    const absolute = path.join(root, ...output.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "export const emitted: number = 1;\n", "utf8");
  }
  assert.equal(
    outputStable,
    await cacheKeyForRun(root, overlay),
    "the overlay outDir and declarationDir must stay outside Metro's key",
  );

  const admitted = path.join(root, "src", "inherited-declarations", "late.ts");
  fs.mkdirSync(path.dirname(admitted), { recursive: true });
  fs.writeFileSync(admitted, "export const late: number = 1;\n", "utf8");
  const afterCreation = await cacheKeyForRun(root, overlay);
  assert.notEqual(
    outputStable,
    afterCreation,
    "creating a source under the replaced inherited declarationDir must re-key Metro",
  );
  fs.writeFileSync(admitted, "export const late: number = 2;\n", "utf8");
  const afterEdit = await cacheKeyForRun(root, overlay);
  assert.notEqual(
    afterCreation,
    afterEdit,
    "editing a source under the replaced inherited declarationDir must re-key Metro",
  );
  fs.rmSync(admitted);
  const afterRemoval = await cacheKeyForRun(root, overlay);
  assert.notEqual(
    afterEdit,
    afterRemoval,
    "removing a source under the replaced inherited declarationDir must re-key Metro",
  );

  const strict = await cacheKeyForRun(root);
  fs.writeFileSync(legacy, "export const legacy = 3;\n", "utf8");
  fs.writeFileSync(
    path.join(root, "src", "ignored.js"),
    "export const ignored = 1;\n",
    "utf8",
  );
  assert.equal(
    strict,
    await cacheKeyForRun(root),
    "without the overlay a .js is not a program input, so neither editing nor adding one re-keys the run",
  );
}

/**
 * Asserts output in a directory no configuration names leaves the cache key
 * alone, while a new source the program could include still moves it.
 *
 * The Metro half of samchon/ttsc#1307's sharpest case, required by
 * samchon/ttsc#1317 and missing when that work merged. Content-hashed output is
 * not a rewrite in place: every rebuild adds a name nothing had seen before,
 * and the walk used to hash every entry regardless of whether it could ever
 * enter the program.
 *
 * Metro reaches that through file hashes alone rather than through the
 * directory-membership snapshot the adapter also keeps — `getCacheKey` folds
 * only `collectProjectInputHashes`, so what has to be absent here is the new
 * file's own hash. The adapter's directory identities are what make the same
 * output cost it a compile, and
 * {@link assertHashedBundleOutputKeepsTheGeneration} in `@ttsc/test-unplugin`
 * covers that side.
 *
 * It costs more here than it does for a bundler. Metro folds one static key
 * into every file's per-content cache key, so a walk that re-keyed on emitted
 * output would discard the entire per-file transform cache rather than cost one
 * compile — and `.expo/` is written to constantly by the dominant React Native
 * toolchain, so the discard would happen on essentially every run.
 *
 * `lib` is deliberately neither the project's `outDir` nor one of the three
 * names the walk still refuses, so nothing but the input-extension rule can
 * make this pass: the project admits no JavaScript, so a `.js` bundle is not a
 * membership change wherever it lands. The `src/late.ts` half is the control
 * that keeps this from passing by never re-keying at all.
 */
export async function assertCacheKeyIgnoresOutputInAnUnlistedDirectory(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);

  const lib = path.join(root, "lib");
  fs.mkdirSync(lib, { recursive: true });
  for (let build = 1; build <= 3; build += 1) {
    fs.writeFileSync(
      path.join(lib, `bundle.${build.toString(16)}f2a.js`),
      `export const build = ${build};\n`,
      "utf8",
    );
    assert.equal(
      await cacheKeyForRun(root),
      before,
      "content-hashed output must not re-key the run that produced it",
    );
  }

  fs.writeFileSync(
    path.join(root, "src", "late.ts"),
    "export const late: number = 1;\n",
    "utf8",
  );
  assert.notEqual(
    await cacheKeyForRun(root),
    before,
    "a new source the program could include must still re-key the run",
  );
}
