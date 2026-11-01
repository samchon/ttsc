import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies lost restored output cannot prevent the ordinary fresh producer.
 *
 * A restored generation can become unavailable before its final admission.
 * Cleanup must not promote that cache failure into a compilation failure.
 *
 * 1. Publish a successful authored generation.
 * 2. Remove restored bytes during final admission and refuse that generation.
 * 3. Require the original producer to rebuild and return its actual output.
 *
 * @evidence contracts/testing.md#behavioral-verification The production cache restores real bytes, then its admission callback removes those bytes and refuses reuse. The next producer call must run and supply the returned status and exact authored JavaScript despite the now-missing cleanup target.
 * @evidence contracts/testing.md#independent-expectations Literal producer counts, successful status and authored output define the fresh fallback contract independently of serialized cache contents or key generation.
 * @evidence contracts/testing.md#distinguishing-cases A successful cold publication precedes refused restoration with a missing cleanup target. Existing store units own ordinary reuse, input movement, corruption, bypass and producer failure.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over temporary files. No compiler process, native build or installed consumer runs; finally removes the owned directory.
 */
export function test_runtimebuildcache_preserves_fresh_build_after_restore_cleanup_failure(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-cleanup-"));
  let builds = 0;
  try {
    const execute = (name: string, loseRestoredOutput: boolean) => {
      const emitDir = path.join(root, name);
      const output = path.join(emitDir, "main.js");
      fs.mkdirSync(emitDir);
      let admissions = 0;
      return RuntimeBuildCache.run({
        directory: path.join(root, "cache"),
        emitDir,
        capture: () => "unchanged-inputs",
        admit: () => {
          if (loseRestoredOutput && ++admissions === 2) {
            fs.unlinkSync(output);
            return false;
          }
          return true;
        },
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(output, "export const value = 7;\n");
          return {
            status: 0,
            diagnostics: [],
            stdout: "fresh producer",
            stderr: "",
            emittedSources: { [output]: [path.join(root, "main.ts")] },
          };
        },
      });
    };
    execute("cold", false);
    assert.equal(builds, 1);
    const result = execute("restored", true);
    assert.equal(builds, 2);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "fresh producer");
    assert.equal(
      fs.readFileSync(path.join(root, "restored/main.js"), "utf8"),
      "export const value = 7;\n",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
