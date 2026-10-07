/**
 * Shared helpers for the ttsx dependency-cache regressions
 * (`acquireDependencyBuildLock`, `releaseDependencyBuildLock`,
 * `reclaimDependencyBuildLock`, `inspectDependencyBuildLock`,
 * `readDependencyCache`). These drive the fenced generation protocol in the
 * built dependency-lock modules directly, with real child processes held at
 * explicit barrier files instead of sleeps, so a stale-observer /
 * delayed-finalizer interleaving is deterministic rather than
 * timing-dependent.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { acquireDependencyBuildLock } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/acquireDependencyBuildLock.js";
import { inspectDependencyBuildLock } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/inspectDependencyBuildLock.js";
import { readDependencyCache } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/readDependencyCache.js";
import { reclaimDependencyBuildLock } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/reclaimDependencyBuildLock.js";
import { releaseDependencyBuildLock } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/releaseDependencyBuildLock.js";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

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

/** Absolute path to one built dependency-lock module used by lock workers. */
function dependencyCacheLibraryPath(module: string): string {
  return path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtime",
    `${module}.js`,
  );
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
};
