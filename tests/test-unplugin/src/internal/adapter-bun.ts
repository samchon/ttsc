import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Minimal shape of the options object passed to `onLoad` in the Bun plugin API. */
type BunLoadOptions = { filter: RegExp };

/**
 * Minimal shape of a Bun load handler: receives a path and returns transformed
 * contents plus the loader Bun should apply next.
 */
type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string } | undefined>;

/**
 * Register the Bun adapter against a capturing `setup` stub and return the
 * first `onLoad` handler plus its filter, mirroring how Bun drives the plugin.
 * No real Bun runtime is required.
 */
async function captureBunLoader(plugin: {
  setup(build: unknown): void;
}): Promise<{ loader: BunLoader; options: BunLoadOptions }> {
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  plugin.setup({
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  });
  const registration = loaders[0];
  assert.ok(registration, "Bun adapter did not register an onLoad handler");
  return registration;
}

/**
 * Asserts that the Bun adapter registers an `onLoad` transformer whose filter
 * matches `.ts` source files and whose loader returns plugin-transformed
 * output.
 *
 * Stubs the Bun `setup` API so no real Bun runtime is required; loads the
 * adapter via `TestUnpluginRuntime.loadUnpluginAdapter("bun")`.
 */
async function assertBunAdapterTransformsSource() {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  unpluginBun().setup({
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  });

  const registration = loaders[0];
  assert.ok(registration);
  const { loader, options } = registration;
  if (!options.filter.test(TestUnpluginProject.mainFile(root))) {
    throw new Error("Bun adapter did not register a TypeScript source filter");
  }
  const result = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(result);
  TestUnpluginProject.assertTransformedToPlugin(result.contents);
  // The loader field is what lets the same adapter drive Bun's runtime
  // (`Bun.plugin` / bunfig preload): Bun must be told the emitted contents are
  // still TypeScript so it keeps transpiling them before execution.
  assert.equal(result.loader, "ts");
}

/**
 * Asserts the Bun adapter never crashes when a transform plugin reports
 * dependencies, and keeps producing correct output on both the fresh transform
 * and the subsequent cache hit.
 *
 * The shared transform calls `addWatchFile` once per plugin-reported
 * dependency. The Bun adapter used to invoke the raw transform with an empty
 * receiver (`{}`), so `this.addWatchFile` was `undefined` and any reported
 * dependency threw `TypeError: this.addWatchFile is not a function` before the
 * loader could return transformed source. Bun exposes no per-module dependency
 * channel, so the adapter must supply an explicit no-op watch context rather
 * than a missing one. The dependency list deliberately mixes a project-relative
 * entry, an absolute entry, a duplicate, and the module itself — every shape
 * that reaches the watch hook — because a single reported entry is enough to
 * trip the old crash.
 */
async function assertBunAdapterSurvivesPluginReportedDependencies() {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const absolute = path.join("/abs", "types", "model.d.ts");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "emit-dependencies",
        dependencies: [
          "src/types.d.ts",
          absolute,
          "src/types.d.ts",
          "src/main.ts",
        ],
      },
    ],
  });
  const { loader } = await captureBunLoader(unpluginBun());

  // Fresh transform: the reported dependencies reach the watch hook. The old
  // empty-receiver context threw here instead of returning source.
  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);
  TestUnpluginProject.assertTransformedToPlugin(first.contents);
  assert.equal(first.loader, "ts");

  // Cache hit: the shared transform replays the dependency notification, so the
  // no-op context must stay valid on the second load too.
  const second = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(second);
  TestUnpluginProject.assertTransformedToPlugin(second.contents);
  assert.equal(second.loader, "ts");
}

/**
 * Asserts excluded files and no-op transforms fall through to Bun's next
 * loader.
 *
 * Bun stops at the first `onLoad` callback that returns a value. The adapter's
 * broad TypeScript filter therefore must consult the shared `transformInclude`
 * predicate before reading and return `undefined` when the path is excluded or
 * the transform produced no code.
 */
async function assertBunAdapterFallsThroughWhenItDoesNotTransform(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const { loader } = await captureBunLoader(
    unpluginBun({
      plugins: [],
    }),
  );

  assert.equal(
    await loader({
      path: path.join(
        TestUnpluginProject.createProject(),
        "node_modules",
        "missing",
        "index.ts",
      ),
    }),
    undefined,
    "an excluded path must not be read or claim the loader chain",
  );

  const root = TestUnpluginProject.createProject({ plugins: [] });
  assert.equal(
    await loader({ path: TestUnpluginProject.mainFile(root) }),
    undefined,
    "a no-op transform must fall through to Bun's built-in TypeScript loader",
  );
}

/**
 * Asserts Bun bundler `onStart` forwards the shared transform build lifecycle.
 *
 * The first compile emits a second module but only serves `main.ts`. After
 * corrupting `main.ts`, the unchanged second module would still be a valid
 * first-use cache hit unless the next build's `onStart` clears the generation.
 */
async function assertBunAdapterClearsCacheOnBuildStart(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/secondary.ts",
      },
    ],
  });
  const secondary = path.join(root, "src", "secondary.ts");
  fs.writeFileSync(secondary, "export const secondary = 1;\n", "utf8");

  let start: (() => void | Promise<void>) | undefined;
  const loaders: BunLoader[] = [];
  unpluginBun().setup({
    onStart(callback: () => void | Promise<void>) {
      start = callback;
    },
    onLoad(_options: BunLoadOptions, loader: BunLoader) {
      loaders.push(loader);
    },
  });
  assert.ok(start, "Bun bundler setup must register onStart when available");
  const loader = loaders[0];
  assert.ok(loader);

  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);
  TestUnpluginProject.assertTransformedToPlugin(first.contents);

  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    "export const broken = true;\n",
    "utf8",
  );
  await start();
  await assert.rejects(
    () => loader({ path: secondary }),
    /expected export const value/,
    "the next build must compile again instead of serving the old generation",
  );
}

/**
 * Asserts Bun's runtime-only plugin shape does not re-read the whole project
 * for every module's first delivery.
 *
 * `Bun.plugin()` exposes `onLoad` but no `onStart`. One setup invocation is one
 * process-scoped module-loading session, so the adapter must start a build
 * scope during setup rather than leave the shared cache in persistent mode.
 */
async function assertBunRuntimeDoesNotRehashProjectPerModule(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/secondary.ts",
      },
    ],
  });
  const secondary = path.join(root, "src", "secondary.ts");
  fs.writeFileSync(secondary, "export const secondary = 1;\n", "utf8");
  const { loader } = await captureBunLoader(unpluginBun());

  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);

  const originalReadFileSync = fs.readFileSync;
  let projectReads = 0;
  fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
    if (
      typeof file === "string" &&
      path.resolve(file).startsWith(`${path.resolve(root)}${path.sep}`)
    ) {
      ++projectReads;
    }
    return (originalReadFileSync as (...values: unknown[]) => unknown)(
      file,
      ...args,
    );
  }) as typeof fs.readFileSync;
  try {
    const lazy = await loader({ path: secondary });
    assert.ok(lazy);
    assert.match(lazy.contents, /secondary = 1/);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
  assert.equal(
    projectReads,
    0,
    "a first module delivery in one Bun runtime session must not walk and hash the project",
  );
}

export {
  assertBunAdapterClearsCacheOnBuildStart,
  assertBunAdapterFallsThroughWhenItDoesNotTransform,
  assertBunAdapterSurvivesPluginReportedDependencies,
  assertBunAdapterTransformsSource,
  assertBunRuntimeDoesNotRehashProjectPerModule,
};
