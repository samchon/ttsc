import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * Snapshot readers and key helpers for the reference-graph cache fingerprint
 * scenarios (samchon/ttsc#721).
 *
 * Metro evaluates `getCacheKey` once per run and folds it into every file's
 * per-content cache key, so "two runs" are simulated the way Metro produces
 * them: a fresh transformer module instance per run (Metro loads the module
 * once per process), with the on-disk project mutated between runs. A key
 * change between runs is exactly Metro's re-transform trigger; a stable key is
 * exactly its cache reuse.
 */

/** Absolute path of the main snapshot file for a project root. */
export function mainSnapshotPath(root: string): string {
  return path.join(
    root,
    "node_modules",
    ".cache",
    "ttsc-metro",
    "graph-inputs.json",
  );
}

/** Absolute path of the snapshot directory for a project root. */
export function snapshotDirectory(root: string): string {
  return path.dirname(mainSnapshotPath(root));
}

/** Parse the main snapshot document, failing the test when absent. */
export function readMainSnapshot(root: string): {
  files: string[];
  id: string;
  tainted: boolean;
  trees: string[];
  version: number;
  volatile: boolean;
} {
  return JSON.parse(fs.readFileSync(mainSnapshotPath(root), "utf8"));
}

/** List the per-worker snapshot files currently on disk. */
export function listWorkerSnapshots(root: string): string[] {
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

/**
 * The worker snapshot the last run wrote: the one worker file no compaction has
 * claimed. A claimed file a compaction merged but could not remove stays beside
 * it on Windows, so the list's first entry is not the run's own.
 */
export function runWorkerSnapshot(root: string): string {
  const unclaimed = listWorkerSnapshots(root).filter(
    (file) => !path.basename(file).startsWith("graph-inputs.worker-claimed-"),
  );
  assert.equal(
    unclaimed.length,
    1,
    `one run's worker snapshot: ${JSON.stringify(listWorkerSnapshots(root))}`,
  );
  return unclaimed[0]!;
}

/** Union of the `files` arrays across every worker snapshot on disk. */
export function workerSnapshotFiles(root: string): string[] {
  const trees = new Set(workerSnapshotTrees(root));
  const union = new Set<string>();
  for (const file of listWorkerSnapshots(root)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of parsed.files ?? []) {
      if (!trees.has(entry)) union.add(entry);
    }
  }
  return [...union].sort();
}

/**
 * The recorded inputs the worker snapshots name as plugin source directories,
 * each also among the recorded files (samchon/ttsc#1487).
 */
export function workerSnapshotTrees(root: string): string[] {
  const union = new Set<string>();
  for (const file of listWorkerSnapshots(root)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of parsed.trees ?? []) {
      assert.ok(parsed.files.includes(entry), "a tree is a recorded file");
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

/** Compute one run's cache key: fresh module, Metro-shaped key options. */
export async function cacheKeyForRun(
  root: string,
  options: Record<string, unknown> = {},
): Promise<string> {
  return TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(), ...options },
    (mod) => mod.getCacheKey({ projectRoot: root }),
  );
}

/** Options that route every transform to the echoing fake upstream. */
export function fakeUpstreamOptions(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    ...extra,
  };
}
