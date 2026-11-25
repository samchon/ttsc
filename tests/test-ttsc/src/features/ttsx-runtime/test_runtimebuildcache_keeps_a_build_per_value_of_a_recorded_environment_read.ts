import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies the runtime store keeps one build per value of the environment
 * variables a plugin recorded reading, on every path a build is stored by
 * (samchon/ttsc#1870).
 *
 * A plugin's reads are reported by its build, after the request is named, so
 * they cannot name the request's document. When every value shared one
 * document, a run with another value was refused and replaced it, and returning
 * to the first value built again. Every repeated value must now be served
 * without building, whether its build was published, parked, read a variable
 * other builds did not, or was published while another build was.
 *
 * 1. Publish in place for `MODE` values `on on off off on off`.
 * 2. Park every build for `on off on off`, so no publication ever runs.
 * 3. Publish `on`, which reads `MODE`, and `off`, which also reads `EXTRA`, then
 *    both again.
 * 4. Build two values with deferred publications and finish them in the opposite
 *    order, then request both again.
 * 5. Require one build per distinct value in each case, each served text to be the
 *    one its value built, and a build that reads nothing to register no
 *    variable set.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store runs real producers, renames and publications over an owned tree; build counts and served texts show that every repeated value reuses its own build, which a shared document, an unregistered parked build, a widened key or an overwritten registration each fail.
 * @evidence contracts/testing.md#independent-expectations Each run's environment decides what its producer reads and writes and what admission accepts, the way RuntimeInputProof replays a recorded read, so expected counts and texts follow from the scenario rather than from stored keys.
 * @evidence contracts/testing.md#distinguishing-cases Published, parked, growing-set and interleaved publications are separate identities, and a read-free identity checks the unchanged plain naming; replay and parking mechanics stay with their own RuntimeBuildCache tests.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the portable store over an owned temporary tree; no compiler or product host runs, and finally removes the tree.
 */
export async function test_runtimebuildcache_keeps_a_build_per_value_of_a_recorded_environment_read(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-cache-env-"));
  try {
    const directory = path.join(root, "cache");
    let builds = 0;
    let sequence = 0;
    const execute = (props: {
      identity: string;
      env: Record<string, string>;
      reads: string[];
      after: "inline" | "park" | "defer";
    }): { text: string; publication?: RuntimeBuildCache.Publication } => {
      const emitDir = path.join(root, `run-${++sequence}`, "emit");
      const output = path.join(emitDir, "main.js");
      fs.mkdirSync(emitDir, { recursive: true });
      let publication: RuntimeBuildCache.Publication | undefined;
      const result = RuntimeBuildCache.run({
        directory,
        emitDir,
        capture: () => undefined,
        identity: () => props.identity,
        // Every recorded read must still hold, as RuntimeInputProof replays it.
        admit: (stored) =>
          Object.entries(stored.environmentInputs ?? {}).every(
            ([name, value]) => value === (props.env[name] ?? null),
          ),
        replay: () => undefined,
        environmentValue: (name) => props.env[name],
        parked: () => undefined,
        recordParked: (fresh) => fresh,
        defer:
          props.after === "inline"
            ? undefined
            : (deferred) => {
                publication = deferred;
              },
        build: (): TtscBuildResult => {
          builds++;
          fs.writeFileSync(output, `built with ${JSON.stringify(props.env)}`);
          return {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: { [output]: [path.join(root, "main.ts")] },
            compilerObservations: { [path.join(root, "main.ts")]: {} },
            ...(props.reads.length === 0
              ? {}
              : {
                  environmentInputs: Object.fromEntries(
                    props.reads.map((name) => [name, props.env[name] ?? null]),
                  ),
                }),
          };
        },
      });
      assert.equal(result.status, 0);
      const served = Object.keys(result.emittedSources ?? {})[0]!;
      const text = fs.readFileSync(served, "utf8");
      // The program ends before its build is stored.
      if (props.after === "park") publication?.park();
      return { text, publication };
    };
    const finish = async (
      publication: RuntimeBuildCache.Publication,
    ): Promise<void> => {
      for (;;) {
        const progress = publication.step();
        if (progress === true) return;
        if (progress !== false) await progress;
      }
    };
    const expect = (
      identity: string,
      after: "inline" | "park",
      steps: [mode: string, builds: number][],
      reads: (mode: string) => string[] = () => ["MODE"],
    ): void => {
      const start = builds;
      for (const [mode, count] of steps) {
        const env = { MODE: mode, EXTRA: "extra" };
        const { text } = execute({ identity, env, reads: reads(mode), after });
        assert.equal(text, `built with ${JSON.stringify(env)}`, identity);
        assert.equal(builds - start, count, `${identity}: ${mode}`);
      }
    };

    expect("published", "inline", [
      ["on", 1],
      ["on", 1],
      ["off", 2],
      ["off", 2],
      ["on", 2],
      ["off", 2],
    ]);
    // A parked build registers its variables, so another value neither finds
    // nor supersedes it.
    expect("parked", "park", [
      ["on", 1],
      ["off", 2],
      ["on", 2],
      ["off", 2],
    ]);
    // A variable only one value reads leaves the other value's key unchanged.
    expect(
      "growing",
      "inline",
      [
        ["on", 1],
        ["off", 2],
        ["on", 2],
        ["off", 2],
      ],
      (mode) => (mode === "off" ? ["EXTRA", "MODE"] : ["MODE"]),
    );

    // Two builds that read different variables, published in either order,
    // both stay registered.
    const first = { MODE: "on" };
    const second = { MODE: "off", OTHER: "1" };
    const start = builds;
    const one = execute({
      identity: "interleaved",
      env: first,
      reads: ["MODE"],
      after: "defer",
    });
    const two = execute({
      identity: "interleaved",
      env: second,
      reads: ["OTHER"],
      after: "defer",
    });
    await finish(two.publication!);
    await finish(one.publication!);
    assert.equal(builds - start, 2);
    for (const [env, reads] of [
      [first, ["MODE"]],
      [second, ["OTHER"]],
    ] as const)
      assert.equal(
        execute({
          identity: "interleaved",
          env,
          reads: [...reads],
          after: "inline",
        }).text,
        `built with ${JSON.stringify(env)}`,
      );
    assert.equal(builds - start, 2, "interleaved publications both reuse");

    const sets = (): string[] =>
      fs.readdirSync(directory).filter((name) => name.endsWith(".environment"));
    const before = sets();
    assert.equal(before.length, 4, "each reading identity registers its sets");
    const plain = builds;
    execute({ identity: "plain", env: {}, reads: [], after: "inline" });
    execute({ identity: "plain", env: {}, reads: [], after: "inline" });
    assert.equal(builds - plain, 1);
    assert.deepEqual(
      sets(),
      before,
      "an identity without reads registers none",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
