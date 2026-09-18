import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeCompilerPlugin,
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
 */
export const test_ttsccompiler_transformasync_matches_transform_without_blocking =
  async () => {
    const hold = 1_000;
    const root = createProject({
      plugins: [{ transform: "./check.cjs" }, { transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    // Descriptor evaluation runs in a child process that plugin loading waits
    // for. The fixture backend answers `check` with success, so one backend
    // serves both stages.
    fs.writeFileSync(
      path.join(root, "check.cjs"),
      [
        `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${hold});`,
        'module.exports = { name: "check-fixture", source: "./plugin-go", stage: "check" };',
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
  };
