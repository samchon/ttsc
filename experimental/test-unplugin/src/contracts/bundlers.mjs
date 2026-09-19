import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  adapter,
  deadline,
  eventQueue,
  expectOutput,
  fixture,
  settledOutput,
  write,
  writeRaceLoader,
} from "./common.mjs";

/** Rollup and Rolldown must follow the real watcher dependency graph. */
export async function rollupContract(name) {
  const project = fixture(name);
  project.break();
  const bundler = await import(name);
  const plugin = await adapter(name, project.options);
  if (name === "rollup") {
    // Rollup emits its first watch ERROR before Chokidar owns subscriptions.
    // An immediate repair can be missed even by a plain native Rollup plugin.
    // Prove initial error delivery and dependency ownership through rollup(),
    // then reuse the plugin in a watcher for the later error/recovery contract.
    await assert.rejects(
      bundler.rollup({ input: project.entry, plugins: [plugin] }),
      (error) => {
        assert.match(error.message, /invalid contract type/);
        assert.ok(error.watchFiles.includes(project.input));
        return true;
      },
    );
    project.change("FIRST");
  }
  const events = eventQueue();
  const watcher = bundler.watch({
    input: project.entry,
    plugins: [plugin],
    output: { file: project.output, format: "esm" },
    watch: { clearScreen: false },
  });
  watcher.on("event", async (event) => {
    if (event.code === "ERROR") events.push(event.error);
    if (event.code === "BUNDLE_END") {
      try {
        const code = fs.readFileSync(project.output, "utf8");
        await event.result?.close();
        events.push(code);
      } catch (error) {
        events.push(error);
      }
    }
  });
  try {
    if (name !== "rollup") {
      await assert.rejects(
        events.next(`${name} initial failure`),
        /invalid contract type/,
      );
      project.change("FIRST");
    }
    expectOutput(
      await settledOutput(events, `${name} first build`, "FIRST"),
      "FIRST",
      4,
    );
    assert.equal(
      project.runs(),
      1,
      `${name} compiles the four-module project once`,
    );
    project.change("SECOND");
    expectOutput(
      await settledOutput(events, `${name} type-only rebuild`, "SECOND"),
      "SECOND",
      4,
    );
    assert.equal(
      project.runs(),
      2,
      `${name} shares one compile across rebuilt modules`,
    );
    project.change("THIRD");
    expectOutput(
      await settledOutput(events, `${name} second rebuild`, "THIRD"),
      "THIRD",
      4,
    );
    assert.equal(project.runs(), 3);
    project.break();
    await assert.rejects(
      events.next(`${name} failed rebuild`),
      /invalid contract type/,
    );
    project.change("FOURTH");
    expectOutput(
      await settledOutput(events, `${name} recovered rebuild`, "FOURTH"),
      "FOURTH",
      4,
    );
    assert.equal(project.runs(), 4);
  } finally {
    await watcher.close();
  }
}

/** A real esbuild watch context must re-run loaders for erased dependencies. */
export async function esbuildContract() {
  const esbuild = await import("esbuild");
  const project = fixture("esbuild");
  project.break();
  const events = eventQueue();
  const context = await esbuild.context({
    absWorkingDir: project.root,
    entryPoints: [project.entry],
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
    plugins: [
      await adapter("esbuild", project.options),
      {
        name: "observe-build-result",
        setup(build) {
          build.onEnd((result) => {
            events.push(
              result.errors.length
                ? new Error(JSON.stringify(result.errors))
                : result.outputFiles[0].text,
            );
          });
        },
      },
    ],
  });
  try {
    await context.watch();
    await assert.rejects(
      events.next("esbuild initial failure"),
      /invalid contract type/,
    );
    project.change("FIRST");
    expectOutput(
      await settledOutput(events, "esbuild first build", "FIRST"),
      "FIRST",
      4,
    );
    assert.equal(project.runs(), 1);
    project.change("SECOND");
    expectOutput(
      await settledOutput(events, "esbuild dependency change", "SECOND"),
      "SECOND",
      4,
    );
    assert.equal(project.runs(), 2);
    project.break();
    await assert.rejects(
      events.next("esbuild failed rebuild"),
      /invalid contract type/,
    );
    project.change("THIRD");
    expectOutput(
      await settledOutput(events, "esbuild recovered rebuild", "THIRD"),
      "THIRD",
      4,
    );
    assert.equal(project.runs(), 3);
    const unchanged = await context.rebuild();
    expectOutput(unchanged.outputFiles[0].text, "THIRD", 4);
    assert.equal(
      project.runs(),
      3,
      "an unchanged esbuild pass reuses its generation",
    );
  } finally {
    await context.dispose();
  }
}

/** Both webpack implementations must rebuild through real loader dependencies. */
export async function webpackContract(name) {
  const project = fixture(name);
  project.break();
  const bundler =
    name === "webpack"
      ? (await import("webpack")).default
      : (await import("@rspack/core")).rspack;
  const plugin = await adapter(name, project.options);
  const events = eventQueue();
  const options = {
    context: project.root,
    mode: "development",
    devtool: false,
    entry: project.entry,
    output: { path: path.dirname(project.output), filename: "bundle.js" },
    module: {
      rules: [
        { test: /\.ts$/, type: "javascript/auto" },
        // Runs after ttsc's pre-enforced loader, so its edit lands between
        // ttsc returning a module and the host recording the module's inputs.
        { test: /\.ts$/, use: [{ loader: writeRaceLoader(project.root) }] },
      ],
    },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [plugin],
  };
  const compiler = bundler(options);
  const watcher = compiler.watch({}, (error, stats) => {
    if (error || stats?.hasErrors())
      events.push(error ?? new Error(stats.toString({ errors: true })));
    else events.push(fs.readFileSync(project.output, "utf8"));
  });
  try {
    await assert.rejects(
      events.next(`${name} initial failure`),
      /invalid contract type/,
    );
    project.change("FIRST");
    expectOutput(
      await settledOutput(events, `${name} first build`, "FIRST"),
      "FIRST",
      4,
    );
    assert.equal(project.runs(), 1);
    project.change("SECOND");
    expectOutput(
      await settledOutput(events, `${name} type-only edit`, "SECOND"),
      "SECOND",
      4,
    );
    assert.equal(project.runs(), 2);
    project.break();
    await assert.rejects(
      events.next(`${name} failed rebuild`),
      /invalid contract type/,
    );
    project.change("THIRD");
    expectOutput(
      await settledOutput(events, `${name} recovered rebuild`, "THIRD"),
      "THIRD",
      4,
    );
    assert.equal(project.runs(), 3);
    watcher.invalidate();
    expectOutput(
      await settledOutput(events, `${name} unchanged rebuild`, "THIRD"),
      "THIRD",
      4,
    );
    assert.equal(project.runs(), 3);
  } finally {
    await deadline(
      new Promise((resolve, reject) =>
        watcher.close((error) => (error ? reject(error) : resolve())),
      ),
      `${name} watcher close`,
    );
    await deadline(
      new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      ),
      `${name} compiler close`,
    );
  }
  // Reuse the plugin object after a true compiler shutdown. The closed
  // compiler's bridge is gone, but its generation holds no watcher: a
  // compiler started within the release grace proves it and reuses it, the
  // way Next runs its server, edge, and client compilers one after another
  // (samchon/ttsc#1396). One started after the grace compiles again.
  const run = async (label) => {
    const next = bundler(options);
    try {
      await deadline(
        new Promise((resolve, reject) =>
          next.run((error, stats) =>
            error || stats?.hasErrors()
              ? reject(error ?? new Error(stats.toString()))
              : resolve(),
          ),
        ),
        `${name} ${label}`,
      );
      expectOutput(fs.readFileSync(project.output, "utf8"), "THIRD", 4);
    } finally {
      await new Promise((resolve, reject) =>
        next.close((error) => (error ? reject(error) : resolve())),
      );
    }
  };
  await run("replacement build");
  assert.equal(project.runs(), 3, `${name} reuses the proven generation`);
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  await run("build after the grace");
  assert.equal(project.runs(), 4, `${name} releases an unused generation`);
  await raceAfterReturn(name, bundler, options, project);
}

/**
 * An edit landing after ttsc returned a module, before the host recorded its
 * inputs (samchon/ttsc#1423): once to an input the module already depended on,
 * once to one it depends on for the first time. Runs in a fresh watcher after
 * the compile-count contract, since each race compiles again.
 */
async function raceAfterReturn(name, bundler, options, project) {
  const events = eventQueue();
  const compiler = bundler(options);
  const watcher = compiler.watch({}, (error, stats) => {
    if (error || stats?.hasErrors())
      events.push(error ?? new Error(stats.toString({ errors: true })));
    else events.push(fs.readFileSync(project.output, "utf8"));
  });
  try {
    expectOutput(await events.next(`${name} race watcher start`), "THIRD", 4);
    project.change("LATE_RACE_FOURTH");
    await settledOutput(events, `${name} edit after ttsc returned`, "FOURTH");
    write(
      project.root,
      "src/newer-input.server.ts",
      'export type ContractInput = "LATE_RACE_FIFTH";\n',
    );
    project.change("FROM_NEWER");
    await settledOutput(
      events,
      `${name} edit after ttsc returned, to a new input`,
      "FIFTH",
    );
  } finally {
    await deadline(
      new Promise((resolve, reject) =>
        watcher.close((error) => (error ? reject(error) : resolve())),
      ),
      `${name} race watcher close`,
    );
    await deadline(
      new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      ),
      `${name} race compiler close`,
    );
  }
}

/** Farm's public Compiler.update owns incremental dependency expansion. */
export async function farmContract() {
  const farm = await import("@farmfe/core");
  const project = fixture("farm");
  const logger = new farm.Logger({ exit: false });
  const resolved = await farm.resolveConfig(
    {
      root: project.root,
      configFile: false,
      compilation: {
        input: { main: "./src/main.ts" },
        output: { path: "./dist-contract", targetEnv: "node", format: "esm" },
        minify: false,
        persistentCache: false,
        lazyCompilation: false,
        progress: false,
      },
      plugins: [await adapter("farm", project.options)],
    },
    "development",
    logger,
  );
  const compiler = await farm.createCompiler(resolved, logger);
  const output = () =>
    Object.values(compiler.resources())
      .map((value) => value.toString())
      .join("\n");
  await compiler.compile();
  expectOutput(output(), "FIRST", 4);
  assert.equal(project.runs(), 1);
  assert.ok(
    compiler
      .resolvedWatchPaths()
      .some((file) => path.resolve(project.root, file) === project.input),
    `Farm must receive the compiler-only dependency: ${JSON.stringify(compiler.resolvedWatchPaths())}`,
  );
  for (const [index, value] of ["SECOND", "THIRD"].entries()) {
    project.change(value);
    const updated = await compiler.update([project.input]);
    expectOutput(
      [updated.mutableModules, updated.immutableModules].join("\n"),
      value,
      4,
    );
    assert.equal(project.runs(), index + 2);
  }
  for (const [index, value] of ["FOURTH", "FIRST"].entries()) {
    project.break();
    await assert.rejects(
      compiler.update([project.input]),
      /invalid contract type/,
    );
    project.change(value);
    const recovered = await compiler.update([project.input]);
    expectOutput(
      [recovered.mutableModules, recovered.immutableModules].join("\n"),
      value,
      4,
    );
    assert.equal(project.runs(), index + 4);
    const unchanged = await compiler.update([project.input]);
    expectOutput(
      [unchanged.mutableModules, unchanged.immutableModules].join("\n"),
      value,
      4,
    );
    assert.equal(
      project.runs(),
      index + 4,
      "unchanged Farm update reuses its generation",
    );
  }
  // Farm's compile() leaves its own failed compiler in the compiling state.
  // Its public recovery is a replacement compiler; the plugin object is reused.
  project.break();
  const failing = await farm.createCompiler(resolved, logger);
  await assert.rejects(failing.compile(), /invalid contract type/);
  project.change("SECOND");
  const replacement = await farm.createCompiler(resolved, logger);
  await replacement.compile();
  expectOutput(
    Object.values(replacement.resources())
      .map((value) => value.toString())
      .join("\n"),
    "SECOND",
    4,
  );
  assert.equal(project.runs(), 6);
  // Farm's Compiler API has no close/dispose method. No server or FileWatcher
  // is constructed here; the aggregate process owns its native compiler.
}
