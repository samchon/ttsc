import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSharedCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transformAsync returns what transform returns, without
 * blocking the event loop at any point, and with the environment as it was at
 * the call.
 *
 * A bundler host calls the transform from its own event loop. The synchronous
 * form held that loop for the whole transform, plugin loading included, so a
 * dev server answered nothing else, and a build could not overlap its own work
 * with the compile (samchon/ttsc#1391). The asynchronous form runs the same
 * transform on a worker thread that adopts `process.env` at the call.
 *
 * 1. Transform a project whose check-plugin descriptor holds its evaluation for a
 *    second, synchronously, then asynchronously. Point `TEMP`, `TMP`, and
 *    `TMPDIR` at a missing directory once the call returns, and sample the
 *    timer queue while it is pending.
 * 2. Assert both envelopes are equal, so the transform never saw the later
 *    environment, and no stall came near the descriptor's hold.
 * 3. Assert a project that cannot be read produces the same exception envelope
 *    from both forms.
 *
 * @evidence contracts/testing.md#behavioral-verification transformAsync matches transform without event-loop stalls and captures environment at the call; both forms report the same missing-config exception.
 * @evidence contracts/testing.md#independent-expectations asynchronous work preserves the synchronous API contract while a literal one-second descriptor hold must not block the calling timer queue; the fixture producer's explicit output is input to the host contract rather than an oracle for compiler AST semantics.
 * @evidence contracts/testing.md#distinguishing-cases successful envelopes, later invalid temp environment, measured timer progress and unreadable config exception are retained.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsccompiler_transformasync_matches_transform_without_blocking function is an API E2E entry under src/features/api; it executes descriptor evaluation child, worker environment capture, actual native producer and asynchronous API scheduling.
 * @evidence contracts/e2e.md#necessary-boundary This case owns descriptor evaluation child, worker environment capture, actual native producer and asynchronous API scheduling; direct decoder or option calls cannot prove this assembly and caller-visible behavior.
 * @evidence contracts/e2e.md#shared-execution Five API consumers share one process-owned immutable compiler producer source and its keyed binary. Private descriptors, projects and API instances retain each case's inputs; source-mutation, proof-path and cold-cache cases keep their isolated producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared Go bytes never change in these five consumers; the product validates source, SDK and environment keys before artifact reuse. Each descriptor and project is private, and the pending worker is awaited and the timer and every changed temp variable are restored in finally. TestProject retains the immutable source until process exit and cleans it on exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and counterexample below remains; only source preparation is shared, and the native envelope decoder matrix executes separately in source units.
 */
export async function test_ttsccompiler_transformasync_matches_transform_without_blocking() {
    const hold = 1_000;
    const root = createProject({
      plugins: [{ transform: "./check.cjs" }, { transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    const producer = writeSharedCompilerPlugin(root);
    // Descriptor evaluation runs in a child process that plugin loading waits
    // for. The fixture backend answers `check` with success, so one backend
    // serves both stages.
    fs.writeFileSync(
      path.join(root, "check.cjs"),
      [
        `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${hold});`,
        `module.exports = { name: "check-fixture", source: ${JSON.stringify(producer)}, stage: "check" };`,
        "",
      ].join("\n"),
      "utf8",
    );
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const expected = compiler.transform();
    const later = path.join(
      TestProject.tmpdir("ttsc-transformasync-later-temp-"),
      "missing",
    );
    const names = ["TEMP", "TMP", "TMPDIR"] as const;
    const previous = names.map((name) => process.env[name]);
    const ticks: number[] = [];
    const timer = setInterval(() => ticks.push(performance.now()), 1);
    const started = performance.now();
    let actual: Awaited<ReturnType<TtscCompiler["transformAsync"]>>;
    try {
      const pending = compiler.transformAsync();
      for (const name of names) process.env[name] = later;
      actual = await pending;
    } finally {
      clearInterval(timer);
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
    assert.deepEqual(actual, expected);
    let longestStall = (ticks[0] ?? performance.now()) - started;
    for (let index = 1; index < ticks.length; index += 1) {
      longestStall = Math.max(longestStall, ticks[index]! - ticks[index - 1]!);
    }
    assert.ok(
      longestStall < hold / 2,
      `the loop ran while plugin loading held: longest stall ${longestStall.toFixed(0)} ms`,
    );

    const missing = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      tsconfig: path.join(root, "missing.json"),
    });
    // The stack differs by construction; the envelope is the rest.
    const envelope = (result: Awaited<typeof actual>) => {
      assert.equal(result.type, "exception");
      if (result.type !== "exception") throw new Error("unreachable");
      return {
        kind: result.kind,
        message: (result.error as Error).message,
        name: (result.error as Error).name,
      };
    };
    assert.deepEqual(
      envelope(await missing.transformAsync()),
      envelope(missing.transform()),
    );
}
