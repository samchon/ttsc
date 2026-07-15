/**
 * Shared helpers for the ttsx dependency-cache regressions
 * (`acquireDependencyBuildLock`, `releaseDependencyBuildLock`,
 * `reclaimDependencyBuildLock`, `inspectDependencyBuildLock`,
 * `readDependencyCache`). These drive the fenced generation protocol in
 * `runtimeHooks.ts` directly, with real child processes held at explicit
 * barrier files instead of sleeps, so a stale-observer / delayed-finalizer
 * interleaving is deterministic rather than timing-dependent.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  acquireDependencyBuildLock,
  inspectDependencyBuildLock,
  readDependencyCache,
  reclaimDependencyBuildLock,
  releaseDependencyBuildLock,
} from "../../../../packages/ttsc/lib/launcher/internal/runtimeHooks.js";

/** Captured output of one dependency-cache lock worker. */
interface IDependencyCacheWorkerResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Spawn a Node.js worker script and capture its complete result. */
function spawnNodeWorker(opts: {
  env?: Record<string, string>;
  script: string;
  timeoutMs?: number;
}): Promise<IDependencyCacheWorkerResult> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(process.execPath, [opts.script], {
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: opts.timeoutMs ?? 120_000,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

/** Absolute path to the built runtime-hooks module used by lock workers. */
function dependencyCacheLibraryPath(): string {
  return path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtimeHooks.js",
  );
}

/**
 * A CommonJS worker that acquires the lock, records its lease, waits for a
 * release barrier file, then runs its normal `finally` release. The role is
 * fixed only by the lease/release/result barrier files passed in the
 * environment, so the same script drives both a held generation and its
 * successor.
 */
function writeLockHolderScript(root: string, lockDir: string): string {
  const libraryPath = dependencyCacheLibraryPath();
  const script = path.join(root, "lock-holder.cjs");
  fs.writeFileSync(
    script,
    [
      `const fs = require("node:fs");`,
      `const { acquireDependencyBuildLock, releaseDependencyBuildLock } = require(${JSON.stringify(
        libraryPath,
      )});`,
      `const lockDir = ${JSON.stringify(lockDir)};`,
      `const leaseFile = process.env.LOCK_LEASE_FILE;`,
      `const releaseFile = process.env.LOCK_RELEASE_FILE;`,
      `const resultFile = process.env.LOCK_RESULT_FILE;`,
      `let lease = null;`,
      `const acquireDeadline = Date.now() + 120000;`,
      `while (lease === null) {`,
      `  lease = acquireDependencyBuildLock(lockDir);`,
      `  if (lease === null) {`,
      `    if (Date.now() > acquireDeadline) throw new Error("timed out acquiring lock");`,
      `    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
      `  }`,
      `}`,
      `fs.writeFileSync(leaseFile, JSON.stringify(lease), "utf8");`,
      `const releaseDeadline = Date.now() + 120000;`,
      `while (!fs.existsSync(releaseFile)) {`,
      `  if (Date.now() > releaseDeadline) throw new Error("timed out waiting to release");`,
      `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
      `}`,
      `const released = releaseDependencyBuildLock(lockDir, lease);`,
      `fs.writeFileSync(resultFile, JSON.stringify({ released }), "utf8");`,
      ``,
    ].join("\n"),
    "utf8",
  );
  return script;
}

/**
 * Polls `predicate` every 25 ms until it holds, failing with `description`
 * after `timeoutMs`. This observes an explicit barrier another process
 * definitely produces; correctness never depends on how long the wait took.
 */
async function waitForCondition(
  predicate: () => boolean,
  description: string,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${description}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export {
  acquireDependencyBuildLock,
  assert,
  dependencyCacheLibraryPath,
  fs,
  inspectDependencyBuildLock,
  path,
  readDependencyCache,
  reclaimDependencyBuildLock,
  releaseDependencyBuildLock,
  spawnNodeWorker,
  waitForCondition,
  writeLockHolderScript,
};
