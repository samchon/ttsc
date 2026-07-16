import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
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

/** Parse the main snapshot document, failing the test when absent. */
function readMainSnapshot(root: string): {
  files: string[];
  id: string;
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
export async function prepareSnapshot(root: string): Promise<void> {
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  fingerprint.prepareSnapshot(root);
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
  // The transform recorded the external input into this worker's snapshot.
  assert.deepEqual(workerSnapshotFiles(root), [external]);

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
 * Asserts a volatile marker in the snapshot also degrades the key to a per-run
 * nonce: a plugin-declared volatile output depends on non-file inputs no
 * fingerprint can represent, so Metro must never replay it across runs.
 */
export async function assertCacheKeyFoldsNonceWhileSnapshotVolatile(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  fs.writeFileSync(
    path.join(snapshotDirectory(root), "graph-inputs.worker-test.json"),
    JSON.stringify({ files: [], version: 1, volatile: true }),
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
    JSON.stringify({ files: [recorded], version: 1, volatile: false }),
    "utf8",
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
 * Asserts compaction heals a corrupt worker snapshot: the unparseable file is
 * swept and the epoch id changes, so keys that might have depended on the lost
 * recordings are orphaned while later runs return to a stable key instead of
 * degrading to a nonce forever.
 */
export async function assertPrepareSnapshotHealsCorruptWorkerFile(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const identity = readMainSnapshot(root).id;
  const corrupt = path.join(
    snapshotDirectory(root),
    "graph-inputs.worker-torn.json",
  );
  fs.writeFileSync(corrupt, "{ torn", "utf8");
  // Until compaction, the unreadable recordings force the nonce degradation.
  assert.notEqual(await cacheKeyForRun(root), await cacheKeyForRun(root));
  await prepareSnapshot(root);
  assert.equal(fs.existsSync(corrupt), false);
  assert.notEqual(readMainSnapshot(root).id, identity);
  // Healed: runs share a stable key again.
  assert.equal(await cacheKeyForRun(root), await cacheKeyForRun(root));
}

/**
 * Asserts the transformer records only out-of-walk inputs into the worker
 * snapshot: an in-project dependency is already covered by the project-walk
 * half of the fingerprint, and recording it would only bloat the snapshot.
 */
export async function assertTransformerRecordsOnlyExternalInputs(): Promise<void> {
  const shared = TestProject.tmpdir("ttsc-metro-shared-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const marker: string;\n", "utf8");

  const root = TestUnpluginProject.createProject({ plugins: [] });
  const inner = path.join(root, "src", "inner.d.ts");
  fs.writeFileSync(inner, "declare const inner: string;\n", "utf8");
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: {
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
    },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.deepEqual(workerSnapshotFiles(root), [external]);
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
