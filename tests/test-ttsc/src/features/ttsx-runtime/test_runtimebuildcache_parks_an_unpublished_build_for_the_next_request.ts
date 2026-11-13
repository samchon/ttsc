import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies a deferred publication parks an unfinished build and the next
 * request adopts it without compiling, rereading or storing it again.
 *
 * Storing a build read every output back before the program started, so a cache
 * miss cost more than an uncached run (samchon/ttsc#1859). A caller that runs
 * the program first takes the publication; when the program ends before it
 * finishes, the outputs move into the store by one rename, and the next request
 * moves them into its own run directory by another.
 *
 * 1. Build under an identity, defer its publication and park it at once.
 * 2. Adopt it, park it again, and adopt it again with the same outputs and job.
 * 3. Finish one adoption's publication into a stored record, then refuse a parked
 *    build whose input moved and a request that does not defer.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store runs a real producer and real renames over an owned tree; counts of builds and recordings, the served output text and the store's directory entries show which path each request took.
 * @evidence contracts/testing.md#independent-expectations The authored state number decides what the producer writes and what the replay answers, so the expected texts and counts follow from the scenario rather than from stored keys.
 * @evidence contracts/testing.md#distinguishing-cases A parked build, its adoption, its unchanged re-parking, a finished idle publication, a moved input that discards the parked build, and a non-deferring request that publishes a parked build in place separate each publication path.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over an owned temporary tree; no compiler or product host runs and finally removes the tree.
 */
export async function test_runtimebuildcache_parks_an_unpublished_build_for_the_next_request(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-park-"));
  try {
    const directory = path.join(root, "cache");
    let disk = 1;
    let builds = 0;
    let recorded = 0;
    let sequence = 0;
    const request = (
      after: "park" | "defer" | "inline",
    ): {
      text: string;
      emitDir: string;
      publication?: RuntimeBuildCache.Publication;
    } => {
      let publication: RuntimeBuildCache.Publication | undefined;
      const emitDir = path.join(root, `run-${++sequence}`, "emit");
      const output = path.join(emitDir, "main.js");
      fs.mkdirSync(emitDir, { recursive: true });
      const result = RuntimeBuildCache.run({
        directory,
        emitDir,
        capture: () => undefined,
        admit: () => true,
        identity: () => "build",
        replay: (stored) =>
          Object.keys(stored.compilerObservations ?? {})[0] === `state-${disk}`
            ? undefined
            : `state-${disk}`,
        record: (fresh) => {
          recorded++;
          return {
            ...fresh,
            compilerObservations: { [`state-${disk}`]: {} },
          };
        },
        parked: () => ({ state: disk }),
        recordParked: (fresh, state) => {
          recorded++;
          return {
            ...fresh,
            compilerObservations: {
              [`state-${(state as { state: number }).state}`]: {},
            },
          };
        },
        defer:
          after === "inline"
            ? undefined
            : (deferred) => {
                publication = deferred;
              },
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(output, `built from state ${disk}`);
          return {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: { [output]: [path.join(root, "main.ts")] },
          };
        },
      });
      assert.equal(result.status, 0);
      const served = Object.keys(result.emittedSources ?? {})[0]!;
      assert.equal(path.dirname(served), emitDir);
      // The program reads its outputs, then ends before the build is stored.
      const text = fs.readFileSync(served, "utf8");
      if (after === "park") publication?.park();
      return { text, emitDir, publication };
    };
    const parkedBuilds = (): string[] => {
      const container = fs
        .readdirSync(directory)
        .find((name) => name.endsWith(".pending"));
      return container === undefined
        ? []
        : fs.readdirSync(path.join(directory, container));
    };

    // A program that ends before its build is stored parks the build.
    const first = request("park");
    assert.equal(first.text, "built from state 1");
    assert.deepEqual([builds, recorded], [1, 0], "parking records nothing");
    assert.equal(fs.existsSync(first.emitDir), false, "outputs moved away");
    assert.equal(parkedBuilds().length, 1);

    // The next request adopts the parked outputs by rename and parks them
    // again; the observations recorded on adoption travel with them.
    const second = request("park");
    assert.equal(second.text, "built from state 1");
    assert.deepEqual([builds, recorded], [1, 1]);
    assert.equal(parkedBuilds().length, 1);
    const third = request("park");
    assert.equal(third.text, "built from state 1");
    assert.deepEqual(
      [builds, recorded],
      [1, 1],
      "an adopted build carries its observations",
    );

    // A request whose program runs long enough stores the adopted build: the
    // caller advances it while the program would run, awaiting its reads.
    const fourth = request("defer");
    assert.equal(fourth.text, "built from state 1");
    const pending = fourth.publication!;
    for (;;) {
      const progress = pending.step();
      if (progress === true) break;
      if (progress !== false) await progress;
    }
    pending.park();
    assert.deepEqual(parkedBuilds(), [], "the stored build is not parked");
    assert.ok(
      fs.readdirSync(directory).some((name) => name.endsWith(".bundle")),
    );
    assert.equal(request("park").text, "built from state 1");
    assert.equal(builds, 1, "the stored record serves without building");

    // A parked build whose input moved is discarded and the build runs.
    disk = 2;
    assert.equal(request("park").text, "built from state 2");
    assert.equal(builds, 2);
    disk = 3;
    assert.equal(request("park").text, "built from state 3");
    assert.equal(builds, 3);
    assert.equal(parkedBuilds().length, 1, "the stale parked build is gone");

    // A request that does not defer publishes a parked build in place.
    assert.equal(request("inline").text, "built from state 3");
    assert.equal(builds, 3);
    assert.deepEqual(parkedBuilds(), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
