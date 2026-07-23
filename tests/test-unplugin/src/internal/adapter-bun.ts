import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Minimal shape of the options object passed to `onLoad` in the Bun plugin API. */
type BunLoadOptions = { filter: RegExp };
type BunBuildConfig = {
  files?: Readonly<Record<string, unknown>>;
  root?: string;
};

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
async function captureBunLoader(
  plugin: {
    setup(build: unknown): void;
  },
  mode: "bundler" | "runtime" = "runtime",
  config?: BunBuildConfig,
): Promise<{
  loader: BunLoader;
  options: BunLoadOptions;
}> {
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  const build = {
    config,
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  } as {
    config?: BunBuildConfig;
    onLoad(options: BunLoadOptions, loader: BunLoader): void;
    onStart?: (callback: () => void | Promise<void>) => void;
  };
  if (mode === "bundler") build.onStart = () => undefined;
  plugin.setup(build);
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
    "bundler",
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
 * Asserts Bun runtime pass-through satisfies its stricter loader contract.
 *
 * Unlike `Bun.build`, `Bun.plugin()` rejects an `onLoad` result of `undefined`.
 * Excluded or unchanged TypeScript must therefore be returned explicitly with
 * its loader instead of using the bundler's next-loader signal.
 */
async function assertBunRuntimePassesThroughUnchangedSource(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const file = TestUnpluginProject.mainFile(root);
  const source = fs.readFileSync(file, "utf8");
  const { loader } = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );

  assert.deepEqual(await loader({ path: file }), {
    contents: source,
    loader: "ts",
  });
}

/**
 * Asserts the Bun adapter filter excludes NUL-prefixed virtual TypeScript ids.
 *
 * A virtual id that reaches this callback would be treated as a filesystem
 * path. This assertion pins the filter boundary without assuming how another
 * Bun runtime plugin schedules or represents its own virtual modules.
 */
async function assertBunAdapterExcludesNulVirtualIds(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const { options } = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );

  assert.equal(options.filter.test("\0virtual.ts"), false);
  assert.equal(options.filter.test("/project/src/ordinary.ts"), true);
  assert.equal(options.filter.test("C:\\project\\src\\ordinary.tsx"), true);
}

/**
 * Asserts Bun build files remain owned by Bun's in-memory loader.
 *
 * `BuildConfig.files` can introduce a path with no disk entry or override an
 * existing one. Reading either through the filesystem violates Bun's stated
 * priority and can produce an `ENOENT` or transform stale disk contents.
 */
async function assertBunAdapterYieldsToConfiguredInMemoryFiles(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const main = TestUnpluginProject.mainFile(root);
  const relativeMain = path.join("src", path.basename(main));
  const reportedRelativeMain = relativeMain.split(path.sep).join("/");
  const virtual = path.resolve(root, "virtual.ts");
  const { loader } = await captureBunLoader(unpluginBun(), "bundler", {
    files: {
      [relativeMain]: "export const memory = true;",
      [virtual]: "export const virtual = true;",
    },
    root,
  });

  const setupDirectory = process.cwd();
  try {
    process.chdir(root);
    assert.equal(
      await loader({ path: reportedRelativeMain }),
      undefined,
      "relative ownership must survive separator and cwd changes",
    );
    assert.equal(
      await loader({ path: virtual }),
      undefined,
      "an absolute files entry must not be read from the filesystem",
    );
  } finally {
    process.chdir(setupDirectory);
  }

  const caseVariant = main.replace(/(^|[\\/])src([\\/])/, "$1SRC$2");
  assert.notEqual(caseVariant, main);
  let optionResolutions = 0;
  const { loader: caseSensitiveLoader } = await captureBunLoader(
    unpluginBun(() => {
      ++optionResolutions;
      return { plugins: [] };
    }),
    "bundler",
    {
      files: {
        [caseVariant]: "export const differentlyCased = true;",
      },
    },
  );
  await caseSensitiveLoader({ path: main });
  assert.equal(
    optionResolutions,
    1,
    "a differently cased files key must not suppress a disk transform",
  );

  const dotAbsoluteMain = `${path.dirname(main)}${path.sep}..${path.sep}src${path.sep}${path.basename(main)}`;
  let spellingOptionResolutions = 0;
  const { loader: spellingLoader } = await captureBunLoader(
    unpluginBun(() => {
      ++spellingOptionResolutions;
      return { plugins: [] };
    }),
    "bundler",
    {
      files: {
        [dotAbsoluteMain]: "export const dotSpelling = true;",
        [relativeMain]: "export const relativeSpelling = true;",
      },
    },
  );
  await spellingLoader({ path: main });
  assert.equal(
    spellingOptionResolutions,
    1,
    "relative and dot-segment files keys must not claim an absolute disk path",
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
 * Asserts Bun's runtime-only plugin shape keeps one immutable generation for
 * the process-scoped module-loading session.
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

  // A persistent-validation cache would observe this unrelated input change
  // and reject the next lazy module. Runtime setup deliberately fences one
  // immutable module-loading session, so the already compiled lazy output
  // remains deliverable without a project-wide validation pass.
  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    "export const broken = true;\n",
    "utf8",
  );
  const lazy = await loader({ path: secondary });
  assert.ok(lazy);
  assert.match(lazy.contents, /secondary = 1/);
}

export {
  assertBunAdapterClearsCacheOnBuildStart,
  assertBunAdapterExcludesNulVirtualIds,
  assertBunAdapterFallsThroughWhenItDoesNotTransform,
  assertBunAdapterSurvivesPluginReportedDependencies,
  assertBunAdapterTransformsSource,
  assertBunAdapterYieldsToConfiguredInMemoryFiles,
  assertBunRuntimePassesThroughUnchangedSource,
  assertBunRuntimeDoesNotRehashProjectPerModule,
};
