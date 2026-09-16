import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  adapter,
  changedOutput,
  deadline,
  eventQueue,
  expectOutput,
  fixture,
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
    expectOutput(await events.next(`${name} first build`), "FIRST", 4);
    assert.equal(
      project.runs(),
      1,
      `${name} compiles the four-module project once`,
    );
    project.change("SECOND");
    expectOutput(await events.next(`${name} type-only rebuild`), "SECOND", 4);
    assert.equal(
      project.runs(),
      2,
      `${name} shares one compile across rebuilt modules`,
    );
    project.change("THIRD");
    expectOutput(await events.next(`${name} second rebuild`), "THIRD", 4);
    assert.equal(project.runs(), 3);
    project.break();
    await assert.rejects(
      events.next(`${name} failed rebuild`),
      /invalid contract type/,
    );
    project.change("FOURTH");
    expectOutput(await events.next(`${name} recovered rebuild`), "FOURTH", 4);
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
    expectOutput(await events.next("esbuild first build"), "FIRST", 4);
    assert.equal(project.runs(), 1);
    project.change("SECOND");
    expectOutput(await events.next("esbuild dependency change"), "SECOND", 4);
    assert.equal(project.runs(), 2);
    project.break();
    await assert.rejects(
      events.next("esbuild failed rebuild"),
      /invalid contract type/,
    );
    project.change("THIRD");
    expectOutput(await events.next("esbuild recovered rebuild"), "THIRD", 4);
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
    module: { rules: [{ test: /\.ts$/, type: "javascript/auto" }] },
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
    expectOutput(await events.next(`${name} first build`), "FIRST", 4);
    assert.equal(project.runs(), 1);
    project.change("SECOND");
    expectOutput(
      await changedOutput(events, `${name} type-only edit`, "SECOND"),
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
    expectOutput(await events.next(`${name} recovered rebuild`), "THIRD", 4);
    assert.equal(project.runs(), 3);
    watcher.invalidate();
    expectOutput(await events.next(`${name} unchanged rebuild`), "THIRD", 4);
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
  // Reuse the plugin object after a true compiler shutdown. A new compiler
  // must not inherit the generation resources owned by the closed one.
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
      `${name} replacement build`,
    );
    expectOutput(fs.readFileSync(project.output, "utf8"), "THIRD", 4);
    assert.equal(project.runs(), 4);
  } finally {
    await new Promise((resolve, reject) =>
      next.close((error) => (error ? reject(error) : resolve())),
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
