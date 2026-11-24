import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies the runtime store keeps one build per value of an environment
 * variable a plugin recorded reading (samchon/ttsc#1870).
 *
 * A plugin's reads are reported by its build, after the request is named, so
 * they cannot enter the identity. Before the fix every value shared one
 * document: a run with another value was rejected and overwrote it, and
 * returning to the first value built again.
 *
 * 1. Build under an identity whose producer records reading `MODE`, with values
 *    `on`, `on`, `off`, `off`, `on`, `off`.
 * 2. Require a build only for the first run of each value, and each restored
 *    output to be the one that value built.
 * 3. Build another identity that records no read and require no read record beside
 *    its document.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store runs real producers and restores their bytes; build counts and restored texts show that the second `on` and `off` runs reuse their own documents, which the shared-document behavior fails.
 * @evidence contracts/testing.md#independent-expectations Each run's value decides what its producer writes and what the admission check accepts, the way RuntimeInputProof replays a recorded read, so expected counts and texts follow from the scenario rather than from stored keys.
 * @evidence contracts/testing.md#distinguishing-cases First and repeated runs of two values, alternation back to an earlier value, and an identity without reads separate per-value documents from the unchanged plain naming; replay and snapshot proof mechanics stay with test_runtimebuildcache_proves_a_stored_result_by_replaying_its_observations.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over an owned temporary tree; no compiler or product host runs, and finally removes the tree.
 */
export function test_runtimebuildcache_keeps_a_build_per_value_of_a_recorded_environment_read(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-env-"));
  try {
    const directory = path.join(root, "cache");
    let builds = 0;
    let sequence = 0;
    const execute = (identity: string, mode: string | undefined): string => {
      const emitDir = path.join(root, `run-${++sequence}`);
      const output = path.join(emitDir, "main.js");
      fs.mkdirSync(emitDir);
      const result = RuntimeBuildCache.run({
        directory,
        emitDir,
        capture: () => undefined,
        identity: () => identity,
        // Every recorded read must still hold, as RuntimeInputProof replays it.
        admit: (stored) =>
          Object.entries(stored.environmentInputs ?? {}).every(
            ([name, value]) => name === "MODE" && value === (mode ?? null),
          ),
        replay: () => undefined,
        environmentValue: (name) => (name === "MODE" ? mode : undefined),
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(output, `built with ${mode ?? "nothing"}`);
          return {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: { [output]: [path.join(root, "main.ts")] },
            compilerObservations: { [path.join(root, "main.ts")]: {} },
            ...(mode === undefined
              ? {}
              : { environmentInputs: { MODE: mode } }),
          };
        },
      });
      assert.equal(result.status, 0);
      return fs.readFileSync(output, "utf8");
    };

    const expected: [string, number][] = [
      ["on", 1],
      ["on", 1],
      ["off", 2],
      ["off", 2],
      ["on", 2],
      ["off", 2],
    ];
    for (const [mode, count] of expected) {
      assert.equal(execute("build", mode), `built with ${mode}`, mode);
      assert.equal(builds, count, `${mode} after ${sequence} runs`);
    }

    const before = new Set(
      fs
        .readdirSync(directory)
        .filter((name) => name.endsWith(".environment.json")),
    );
    assert.equal(before.size, 1, "the reading identity records its reads");
    assert.equal(execute("plain", undefined), "built with nothing");
    assert.equal(execute("plain", undefined), "built with nothing");
    assert.equal(builds, 3);
    const after = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".environment.json"));
    assert.deepEqual(
      new Set(after),
      before,
      "an identity without reads records none",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
