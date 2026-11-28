import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";

/**
 * Verifies that a managed launcher publishes an adopted build once and keeps
 * its parked output for a torn document.
 *
 * 1. Park a fresh build, adopt it, complete its publication and clean up the run.
 * 2. Require the next request to serve the document without adopting or writing.
 * 3. Replace only the bundle and require recovery from the retained output.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store completes normal deferred publication, replays the launcher receipt, restores the durable pair, and falls back to the parked output after a real bundle overwrite.
 * @evidence contracts/testing.md#independent-expectations Authored output bytes, one producer call and the absence or presence of a publication callback and native parked-directory move independently distinguish the two reuse paths.
 * @evidence contracts/testing.md#distinguishing-cases A fresh parked build is adopted; an already-published adoption remains parked while a valid document serves; a torn document restores exactly that fallback.
 * @evidence contracts/testing.md#execution-ownership The unit creates a private native temp tree, drives one publication to completion and starts no process or compiler.
 */
export async function test_runtimebuildcache_prefers_published_launcher_adoption(): Promise<void> {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-published-adoption-")),
  );
  const store = path.join(root, "runtime-builds");
  const source = path.join(root, "source.ts");
  const canChange = (directory: string) =>
    systemRuntimeRunCanChange(directory, root, []);
  const expected = "exports.answer = 47;\n";
  let builds = 0;
  const request = (name: string) => {
    const run = path.join(root, "project", name);
    const emitDir = path.join(run, "fs", "output");
    const output = path.join(emitDir, "main.js");
    let publication: RuntimeBuildCache.Publication | undefined;
    fs.mkdirSync(emitDir, { recursive: true });
    const result = RuntimeBuildCache.run({
      directory: store,
      canChange,
      runDir: run,
      emitDir,
      capture: () => "fixed snapshot",
      admit: () => true,
      recordParked: (value) => value,
      defer: (value) => {
        publication = value;
      },
      build: () => {
        assert.equal(++builds, 1);
        fs.writeFileSync(output, expected);
        return {
          status: 0,
          diagnostics: [],
          stdout: "",
          stderr: "",
          emittedSources: { [output]: [source] },
        };
      },
    });
    assert.equal(result.status, 0);
    assert.deepEqual(result.emittedSources, { [output]: [source] });
    assert.equal(fs.readFileSync(output, "utf8"), expected);
    return { run, emitDir, publication };
  };
  try {
    const fresh = request("fresh");
    assert.ok(fresh.publication);
    fresh.publication.park();
    assert.equal(fs.existsSync(fresh.emitDir), false);
    const adopted = request("adopted");
    assert.ok(adopted.publication);
    for (;;) {
      const progress = adopted.publication.step();
      if (progress === true) break;
      if (progress !== false) await progress;
    }
    adopted.publication.park();
    RuntimeBuildCache.parkRequested(adopted.run, store, canChange);
    assert.equal(fs.existsSync(adopted.emitDir), false);

    const contents = fs.readdirSync(store);
    const pendingName = contents.find((name) => name.endsWith(".pending"));
    const bundleName = contents.find((name) => name.endsWith(".bundle"));
    assert.ok(pendingName);
    assert.ok(bundleName);
    const pending = path.join(store, pendingName);
    const [fallbackName, ...others] = fs.readdirSync(pending);
    assert.ok(fallbackName);
    assert.deepEqual(others, []);
    const fallback = path.join(pending, fallbackName);
    const bundle = path.join(store, bundleName);
    const durable = fs.readFileSync(bundle);

    const warm = request("warm");
    assert.equal(warm.publication, undefined);
    RuntimeBuildCache.parkRequested(warm.run, store, canChange);
    assert.deepEqual(fs.readdirSync(pending), [fallbackName]);
    assert.deepEqual(fs.readFileSync(bundle), durable);

    fs.writeFileSync(bundle, "torn body");
    const recovered = request("recovered");
    assert.ok(recovered.publication);
    assert.equal(fs.existsSync(fallback), false);
    assert.equal(builds, 1);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
