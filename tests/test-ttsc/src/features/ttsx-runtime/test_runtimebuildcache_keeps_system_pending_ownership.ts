import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";

/**
 * Exercises project preservation and legitimate parking in a system runtime
 * cache.
 *
 * @evidence contracts/testing.md#behavioral-verification The native store reads real saved requests, parks and adopts the original run's output, and preserves foreign trees and an aliased pending parent.
 * @evidence contracts/testing.md#independent-expectations Authored marker and output bytes, original coordinates and an independent producer count distinguish an actual reuse from an uncached build.
 * @evidence contracts/testing.md#distinguishing-cases An ordinary pending item, an ordinary marked project, an aliased pending parent, and a record naming another run are observed separately.
 * @evidence contracts/testing.md#execution-ownership The unit uses an owned temporary tree and removes the junction before removing the tree. It starts no compiler or watcher.
 */
export function test_runtimebuildcache_keeps_system_pending_ownership(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-pending-ownership-")),
  );
  const systemCache = path.join(root, "runtime");
  const run = path.join(systemCache, "project", "owned-run");
  const store = path.join(systemCache, "runtime-builds");
  const project = path.join(root, "consumer");
  const generation = (owner: string) =>
    path.join(
      owner,
      "deps",
      "a".repeat(16),
      "gen-" + crypto.randomBytes(16).toString("hex"),
    );
  const outsideOutput = generation(
    path.join(systemCache, "project", "different-run"),
  );
  const source = path.join(project, "main.ts");
  const canChange = (directory: string) =>
    systemRuntimeRunCanChange(directory, systemCache, [project]);
  const parks = path.join(run, "parks");
  let builds = 0;
  const build = (emitDir: string) => {
    fs.mkdirSync(emitDir, { recursive: true });
    return RuntimeBuildCache.run({
      directory: store,
      canChange,
      runDir: run,
      parkIn: run,
      emitDir,
      capture: () => undefined,
      admit: () => true,
      identity: () => "owned-build",
      replay: () => undefined,
      recordParked: (result) => result,
      build: () => {
        ++builds;
        const output = path.join(emitDir, "main.js");
        fs.writeFileSync(output, "owned build output");
        return {
          status: 0,
          diagnostics: [],
          stdout: "",
          stderr: "",
          emittedSources: { [output]: [source] },
        };
      },
    });
  };
  try {
    fs.mkdirSync(project);
    fs.mkdirSync(outsideOutput, { recursive: true });
    fs.writeFileSync(path.join(outsideOutput, "keep.js"), "another run");
    const firstOutput = generation(run);
    assert.equal(build(firstOutput).status, 0);
    const [record] = fs.readdirSync(parks);
    assert.ok(record);
    const request = JSON.parse(
      fs.readFileSync(path.join(parks, record), "utf8"),
    );
    const pending = path.dirname(request.parked);
    const forgedParked = path.join(pending, `1-1-${crypto.randomUUID()}`);
    fs.writeFileSync(
      path.join(parks, "outside.json"),
      JSON.stringify({
        ...request,
        outputs: outsideOutput,
        parked: forgedParked,
        job: { ...request.job, emitDir: outsideOutput },
      }),
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(firstOutput), false);
    assert.equal(fs.existsSync(forgedParked), false);
    assert.equal(
      fs.readFileSync(path.join(outsideOutput, "keep.js"), "utf8"),
      "another run",
    );

    const foreign = path.join(pending, "foreign-project");
    fs.mkdirSync(foreign);
    fs.writeFileSync(path.join(foreign, "go.work"), "go 1.24.0\n");
    const adopted = generation(run);
    assert.equal(build(adopted).status, 0);
    assert.equal(builds, 1);
    assert.equal(
      fs.readFileSync(path.join(adopted, "main.js"), "utf8"),
      "owned build output",
    );
    assert.equal(
      fs.readFileSync(path.join(foreign, "go.work"), "utf8"),
      "go 1.24.0\n",
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(adopted), false);

    const redirected = path.join(root, "redirected-pending");
    fs.renameSync(pending, redirected);
    const before = fs.readdirSync(redirected).sort();
    fs.symlinkSync(redirected, pending, "junction");
    try {
      const isolated = generation(run);
      assert.equal(build(isolated).status, 0);
      assert.equal(builds, 2);
      RuntimeBuildCache.parkRequested(run, store, canChange);
      assert.equal(
        fs.readFileSync(path.join(isolated, "main.js"), "utf8"),
        "owned build output",
      );
      assert.deepEqual(fs.readdirSync(redirected).sort(), before);
    } finally {
      if (process.platform === "win32") fs.rmdirSync(pending);
      else fs.unlinkSync(pending);
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
