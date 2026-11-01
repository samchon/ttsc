import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies completed runtime bytes are reused under a new run's provenance,
 * while input changes, proof refusal, corruption and no-cache still build.
 *
 * 1. Publish one authored output and restore it into a distinct run directory.
 * 2. Change the snapshot, damage storage and disable caching independently.
 * 3. Assert actual build calls, exact bytes and rebased output ownership.
 *
 * @evidence contracts/testing.md#behavioral-verification The production document store executes a writing producer and restores its bytes; invocation counts distinguish real reuse from rebuilding while exact text and provenance prove the returned output belongs to the current run.
 * @evidence contracts/testing.md#independent-expectations Authored v1/v2 text, literal build counts and the original source path determine expectations independently of cache key or serialized document internals.
 * @evidence contracts/testing.md#distinguishing-cases Cold and warm runs use distinct output directories; changed inputs, invalid JSON, explicit bypass and independent proof refusal must each execute the producer, while modifying a restored run must not poison the persisted document.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc unit runner discovers the named export; only the production cache owner and portable filesystem semantics run, without a compiler or consumer host.
 */
export function test_runtimebuildcache_reuses_private_bytes_and_invalidates_changed_inputs(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsx-runtime-cache-unit-"),
  );
  try {
    const directory = path.join(root, "cache");
    const source = path.join(root, "source.ts");
    let snapshot = "v1";
    let builds = 0;
    const execute = (name: string, enabled = true, admitted = true) => {
      const emitDir = path.join(root, name);
      fs.mkdirSync(emitDir);
      const result = RuntimeBuildCache.run({
        directory: enabled ? directory : undefined,
        emitDir,
        capture: () => snapshot,
        admit: () => admitted,
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(
            path.join(emitDir, "main.js"),
            `console.log('${snapshot}');`,
          );
          fs.writeFileSync(path.join(emitDir, "main.js.map"), '{"version":3}');
          return {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: { [path.join(emitDir, "main.js")]: [source] },
          };
        },
      });
      assert.deepEqual(result.emittedSources, {
        [path.join(emitDir, "main.js")]: [source],
      });
      assert.equal(
        fs.readFileSync(path.join(emitDir, "main.js"), "utf8"),
        `console.log('${snapshot}');`,
      );
      assert.equal(
        fs.readFileSync(path.join(emitDir, "main.js.map"), "utf8"),
        '{"version":3}',
      );
      return emitDir;
    };
    execute("cold");
    const warm = execute("warm");
    assert.equal(builds, 1);
    fs.writeFileSync(path.join(warm, "main.js"), "modified run");
    execute("warm-again");
    assert.equal(builds, 1);
    snapshot = "v2";
    execute("changed");
    assert.equal(builds, 2);
    for (const file of fs.readdirSync(directory))
      fs.writeFileSync(path.join(directory, file), "invalid JSON");
    execute("corrupt");
    assert.equal(builds, 3);
    execute("disabled", false);
    assert.equal(builds, 4);
    execute("unproved", true, false);
    assert.equal(builds, 5);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
