import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DependencyBuildAdmission } from "../../../../../packages/ttsc/src/launcher/internal/runtime/DependencyBuildAdmission";
import { RuntimeDependencyPrebuild } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeDependencyPrebuild";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";

/**
 * Verifies managed dependency admission and usage recording against linked
 * storage.
 *
 * 1. Qualify an ordinary generation and refuse its linked completion marker.
 * 2. Redirect the dependency directory and verify that admission takes its
 *    fallback without touching the redirected lock namespace.
 * 3. Refuse a shared hint and then persist successfully appended ordinary hints.
 *
 * @evidence contracts/testing.md#behavioral-verification The native cache reader and lease admission exercise real metadata, output and alias paths; the runtime hint owner reads and appends using its production entry points.
 * @evidence contracts/testing.md#independent-expectations Original JavaScript and hint bytes, the authored build metadata, the destination directory listing and the separated fallback exception identify each outcome.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary metadata hits, linked metadata misses, a linked dependency ancestor refuses reuse and lock acquisition, and a shared hint refuses changes while an ordinary hint keeps both appends.
 * @evidence contracts/testing.md#execution-ownership The fixture owns all temporary entries, removes the junction before recursive cleanup and invokes no compiler or external process.
 */
export function test_managed_dependency_cache_refuses_linked_storage(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-managed-dependencies-")),
  );
  const system = path.join(root, "runtime");
  const project = path.join(root, "project");
  const config = path.join(project, "tsconfig.json");
  const run = path.join(system, "project", "run");
  const store = path.join(system, "runtime-builds");
  const deps = path.join(run, "deps");
  const key = "a".repeat(16);
  const cache = path.join(deps, key);
  const lock = path.join(deps, `${key}.lock`);
  const meta = path.join(deps, `${key}.json`);
  const generation = "b".repeat(32);
  const emit = path.join(cache, `gen-${generation}`);
  const hint = path.join(run, RuntimeDependencyPrebuild.USED_FILENAME);
  const foreign = path.join(root, "foreign");
  const canChange = (directory: string) =>
    systemRuntimeRunCanChange(directory, system, [project]);
  try {
    fs.mkdirSync(project);
    fs.mkdirSync(emit, { recursive: true });
    fs.writeFileSync(path.join(emit, "index.js"), "exports.original = 47;\n");
    const sourceMarker = path.join(project, "package.json");
    const emittedMarker = path.join(emit, "package.json");
    fs.writeFileSync(sourceMarker, '{"name":"original"}\n');
    fs.copyFileSync(sourceMarker, emittedMarker);
    const marker = JSON.stringify({
      generation,
      moduleOptions: { module: "commonjs" },
      emittedSources: { [emittedMarker]: [sourceMarker] },
      outputs: ["index.js"],
      rootDir: project,
    });
    fs.writeFileSync(meta, marker);
    assert.equal(readDependencyCache(cache, meta, canChange)?.emitDir, emit);
    fs.writeFileSync(emittedMarker, '{"name":"unrelated"}\n');
    assert.equal(readDependencyCache(cache, meta, canChange), null);
    fs.copyFileSync(sourceMarker, emittedMarker);
    const originalMarker = path.join(root, "original.json");
    fs.renameSync(meta, originalMarker);
    fs.linkSync(originalMarker, meta);
    assert.equal(readDependencyCache(cache, meta, canChange), null);
    fs.unlinkSync(meta);
    fs.renameSync(originalMarker, meta);
    fs.renameSync(deps, foreign);
    fs.symlinkSync(foreign, deps, "junction");
    try {
      const fallback = new Error("private fallback reached");
      assert.throws(
        () =>
          DependencyBuildAdmission.run(
            cache,
            meta,
            lock,
            () => {
              throw fallback;
            },
            undefined,
            canChange,
          ),
        (error) => error === fallback,
      );
      assert.deepEqual(fs.readdirSync(foreign).sort(), [key, `${key}.json`]);
      assert.equal(fs.readFileSync(meta, "utf8"), marker);
    } finally {
      if (process.platform === "win32") fs.rmdirSync(deps);
      else fs.unlinkSync(deps);
    }

    const foreignHint = path.join(root, "foreign-hint.txt");
    fs.writeFileSync(foreignHint, `${config}\n`);
    fs.linkSync(foreignHint, hint);
    const remember = {
      runDir: run,
      store,
      tsconfig: config,
      plugins: undefined,
      canChange,
    };
    RuntimeDependencyPrebuild.note(run, config, canChange);
    RuntimeDependencyPrebuild.remember(remember);
    assert.equal(fs.readFileSync(foreignHint, "utf8"), `${config}\n`);
    assert.equal(fs.existsSync(store), false);
    fs.unlinkSync(hint);
    const another = path.join(project, "another.json");
    RuntimeDependencyPrebuild.note(run, config, canChange);
    RuntimeDependencyPrebuild.note(run, another, canChange);
    RuntimeDependencyPrebuild.remember(remember);
    assert.equal(fs.readFileSync(hint, "utf8"), `${config}\n${another}\n`);
    const [record] = fs.readdirSync(store);
    assert.ok(record);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(store, record), "utf8")),
      [another, config],
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
