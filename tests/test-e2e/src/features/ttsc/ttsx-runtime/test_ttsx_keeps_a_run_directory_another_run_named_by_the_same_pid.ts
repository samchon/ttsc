import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { spawnNodeWorker } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a ttsx run never takes the runtime directory of another run whose
 * process has the same id.
 *
 * A run named its directory by its process id alone, and cleared that name
 * before claiming it. A process of another host sharing the cache root can hold
 * the same id, and so can a process given the id of one that was killed while a
 * sweep removes that one's directory, so a run could erase a directory another
 * run was using (samchon/ttsc#1579). A run's directory is now named by its
 * process id followed by a nonce.
 *
 * 1. In a child process, create `<cache>/project/<its own pid>` owned by that pid
 *    on another host, holding a file that run is using.
 * 2. Prepare a ttsx run in that child with the same cache root.
 * 3. Assert the other run's directory and file are untouched, and the prepared
 *    run's directory is its own.
 *
 * @evidence contracts/testing.md#behavioral-verification A worker plants a remote-host PID-named run then calls prepareExecution with its own identical PID; assertions require the old file to survive and the new run path to differ.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately records a different hostname and current worker PID, making non-reclamation required even if local PID probes agree; literal file survival and path inequality are independent of runtimeRunKey.
 * @evidence contracts/testing.md#distinguishing-cases The same PID with a different host distinguishes PID-only identity from per-run identity; actual local dead-owner reclamation is exercised by other ownership cases.
 * @evidence contracts/testing.md#execution-ownership The named async E2E entry owns the worker and real preparation/compiler connection; spawnNodeWorker provides transport and does not replace the native compiler in this case.
 * @evidence contracts/e2e.md#necessary-boundary Native preparation must allocate a distinct run without erasing a conservative remote-owner tree; a pure nonce unit cannot establish the destructive filesystem behavior.
 * @evidence contracts/e2e.md#shared-execution One worker lifetime seeds the competing identity and performs one checked preparation with the shared native artifact; no separate CLI consumer or plugin build is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A dedicated cache and worker-owned PID isolate the conflict; the worker exits after reporting, leaving prepared and foreign-owner trees to TestProject cleanup. The worker helper has a bounded process timeout.
 * @evidence contracts/e2e.md#preserved-coverage Worker success, other-run file preservation and distinct resolved path strings remain here; this case does not independently check nonce randomness or remote process liveness.
 */
export async function test_ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid(): Promise<void> {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid/inputs-1",
    ),
  );
  const cache = TestProject.tmpdir("ttsx-shared-pid-cache-");
  const worker = path.join(root, "prepare-worker.cjs");
  fs.writeFileSync(
    worker,
    [
      'const fs = require("node:fs");',
      'const os = require("node:os");',
      'const path = require("node:path");',
      `const { prepareExecution } = require(${JSON.stringify(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "ttsc",
          "lib",
          "launcher",
          "internal",
          "prepareExecution.js",
        ),
      )});`,
      `const cache = ${JSON.stringify(cache)};`,
      'const other = path.join(cache, "project", String(process.pid));',
      "fs.mkdirSync(other, { recursive: true });",
      "fs.writeFileSync(",
      '  path.join(other, "owner-" + process.pid + ".json"),',
      '  JSON.stringify({ hostname: os.hostname() + "-elsewhere", pid: process.pid }),',
      ");",
      'fs.writeFileSync(path.join(other, "in-use.txt"), "in use");',
      `const execution = prepareExecution(${JSON.stringify(
        path.join(root, "src", "main.ts"),
      )}, { cacheDir: cache });`,
      "process.stdout.write(JSON.stringify({",
      "  other,",
      '  otherKept: fs.existsSync(path.join(other, "in-use.txt")),',
      "  runDirectory: execution.cleanupDir,",
      "}));",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = await spawnNodeWorker({
    env: {
      TTSC_BINARY: TestProject.NATIVE_BINARY,
      TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
    },
    script: worker,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as {
    other: string;
    otherKept: boolean;
    runDirectory: string;
  };
  assert.equal(
    report.otherKept,
    true,
    "a run erased the directory of another run with its process id",
  );
  assert.notEqual(
    path.resolve(report.runDirectory),
    path.resolve(report.other),
    "a run claimed the directory of another run with its process id",
  );
}
