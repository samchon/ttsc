import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/** Minimal shape of the options object passed to `onLoad` in the Bun plugin API. */
type BunLoadOptions = { filter: RegExp };

/**
 * Minimal shape of a Bun load handler: receives a path and returns transformed
 * contents plus the loader Bun should apply next.
 */
type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string }>;

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
  TestUnpluginProject.assertTransformedToPlugin(first.contents);
  assert.equal(first.loader, "ts");

  // Cache hit: the shared transform replays the dependency notification, so the
  // no-op context must stay valid on the second load too.
  const second = await loader({ path: TestUnpluginProject.mainFile(root) });
  TestUnpluginProject.assertTransformedToPlugin(second.contents);
  assert.equal(second.loader, "ts");
}

export {
  assertBunAdapterSurvivesPluginReportedDependencies,
  assertBunAdapterTransformsSource,
};
