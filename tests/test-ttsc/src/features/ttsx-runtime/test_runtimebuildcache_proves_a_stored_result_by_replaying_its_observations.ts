import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies a stored result named by a build identity is proven by replaying its
 * own recorded observations, without capturing an input snapshot.
 *
 * A snapshot proof has to observe every input before it can even name its
 * document, which for a compile means asking the compiler for its source
 * selection on every run (samchon/ttsc#1852). A producer that reports what it
 * observed lets the next run find the document first and replay it.
 *
 * 1. Build under an identity and store the result with its observations.
 * 2. Reuse it while the replay holds; rebuild once it names a moved input, and
 *    reuse the replacement.
 * 3. Keep a result without observations, another identity, and a refused identity
 *    apart.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store runs real producers and restores their bytes; counts of builds, snapshot captures and replays, with the restored text, show which proof decided each request.
 * @evidence contracts/testing.md#independent-expectations Authored state numbers decide what the replay answers and the producer writes, so the expected counts and texts follow from the scenario rather than from stored keys or documents.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged replay, a moved input, the replacing document, a producer without observations, a second identity, a refused identity that falls back to the snapshot proof, and an input that moves during the build separate replayed proof from snapshot proof and from no proof.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over an owned temporary tree; no compiler or product host runs and finally removes the tree.
 */
export function test_runtimebuildcache_proves_a_stored_result_by_replaying_its_observations(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-replay-"));
  try {
    const directory = path.join(root, "cache");
    let disk = 1;
    let builds = 0;
    let captures = 0;
    let replays = 0;
    let sequence = 0;
    const execute = (
      props: {
        identity?: string;
        observed?: boolean;
        moving?: boolean;
      } = {},
    ): string => {
      const emitDir = path.join(root, `run-${++sequence}`);
      const output = path.join(emitDir, "main.js");
      fs.mkdirSync(emitDir);
      const result = RuntimeBuildCache.run({
        directory,
        emitDir,
        capture: () => {
          captures++;
          return `snapshot-${disk}`;
        },
        admit: () => true,
        identity: () => props.identity,
        replay: (stored) => {
          replays++;
          if (stored.compilerObservations === undefined) return "";
          return Object.keys(stored.compilerObservations)[0] === `state-${disk}`
            ? undefined
            : `state-${disk}`;
        },
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(output, `built from state ${disk}`);
          const built: TtscBuildResult = {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: { [output]: [path.join(root, "main.ts")] },
            ...(props.observed === false
              ? {}
              : { compilerObservations: { [`state-${disk}`]: {} } }),
          };
          if (props.moving) disk++;
          return built;
        },
      });
      assert.equal(result.status, 0);
      return fs.readFileSync(output, "utf8");
    };

    assert.equal(execute({ identity: "build" }), "built from state 1");
    assert.deepEqual([builds, captures], [1, 0]);
    assert.equal(execute({ identity: "build" }), "built from state 1");
    assert.deepEqual(
      [builds, captures],
      [1, 0],
      "a replayed hit builds nothing",
    );
    assert.ok(replays > 0);

    // An input moved: the replay names it and the document is replaced.
    disk = 2;
    assert.equal(execute({ identity: "build" }), "built from state 2");
    assert.equal(builds, 2);
    assert.equal(execute({ identity: "build" }), "built from state 2");
    assert.equal(builds, 2);
    disk = 1;
    assert.equal(execute({ identity: "build" }), "built from state 1");
    assert.equal(builds, 3, "one document per identity keeps the latest state");

    // Another identity never answers for this one.
    assert.equal(execute({ identity: "other" }), "built from state 1");
    assert.equal(builds, 4);
    assert.equal(execute({ identity: "build" }), "built from state 1");
    assert.equal(builds, 4);

    // A producer that reports no observations leaves nothing to replay.
    execute({ identity: "unobserved", observed: false });
    execute({ identity: "unobserved", observed: false });
    assert.equal(builds, 6);

    // An input that moves while it is compiled is not what the result saw.
    execute({ identity: "moving", moving: true });
    execute({ identity: "moving" });
    assert.equal(builds, 8);
    execute({ identity: "moving" });
    assert.equal(builds, 8);
    assert.equal(captures, 0, "a replayed proof never captures a snapshot");

    // A refused identity keeps the snapshot proof.
    execute();
    assert.deepEqual([builds, captures > 0], [9, true]);
    execute();
    assert.equal(builds, 9);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
