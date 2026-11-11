import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies a restore that fails part-way cannot prevent the fresh producer.
 *
 * A stored generation can be admitted and still fail to reach the run's
 * directory. That cache failure must cost reuse only: what was already restored
 * is withdrawn and the original producer supplies the run.
 *
 * 1. Publish a successful authored generation of two outputs.
 * 2. Occupy the second output's path in the next run, so restoring it fails after
 *    the first output was written.
 * 3. Require the original producer to run and return its actual output, with no
 *    restored file left beside it.
 *
 * @evidence contracts/testing.md#behavioral-verification The production cache admits a real stored generation, writes its first output and meets a real native refusal on the second. The producer must then run, find the directory without the restored file, and supply the returned status and the exact authored JavaScript.
 * @evidence contracts/testing.md#independent-expectations Literal producer counts, the successful status, the authored texts and the producer's own observation of the directory define the fallback contract independently of serialized cache contents or key generation.
 * @evidence contracts/testing.md#distinguishing-cases A successful cold publication precedes an admitted but physically refused restoration. Existing store units own ordinary reuse, input movement, corruption, bypass and producer failure.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over temporary files. No compiler process, native build or installed consumer runs; finally removes the owned directory.
 */
export function test_runtimebuildcache_preserves_fresh_build_after_a_failed_restore(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-restore-"));
  let builds = 0;
  let restoredLeftovers: string[] | undefined;
  try {
    const execute = (name: string, obstruct: boolean) => {
      const emitDir = path.join(root, name);
      const first = path.join(emitDir, "a.js");
      const second = path.join(emitDir, "b.js");
      fs.mkdirSync(emitDir);
      // A directory where the second output belongs refuses its restoration.
      if (obstruct) fs.mkdirSync(second);
      return RuntimeBuildCache.run({
        directory: path.join(root, "cache"),
        emitDir,
        capture: () => "unchanged-inputs",
        admit: () => true,
        build: (): TtscBuildResult => {
          builds++;
          if (obstruct) {
            fs.rmdirSync(second);
            restoredLeftovers = fs.readdirSync(emitDir);
          }
          fs.writeFileSync(first, "export const value = 7;\n");
          fs.writeFileSync(second, "export const other = 11;\n");
          return {
            status: 0,
            diagnostics: [],
            stdout: "fresh producer",
            stderr: "",
            emittedSources: {
              [first]: [path.join(root, "a.ts")],
              [second]: [path.join(root, "b.ts")],
            },
          };
        },
      });
    };
    execute("cold", false);
    assert.equal(builds, 1);
    const result = execute("restored", true);
    assert.equal(builds, 2);
    assert.deepEqual(restoredLeftovers, []);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "fresh producer");
    assert.equal(
      fs.readFileSync(path.join(root, "restored/a.js"), "utf8"),
      "export const value = 7;\n",
    );
    assert.equal(
      fs.readFileSync(path.join(root, "restored/b.js"), "utf8"),
      "export const other = 11;\n",
    );
    // The stored generation itself was sound: an unobstructed run reuses it.
    execute("reused", false);
    assert.equal(builds, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
