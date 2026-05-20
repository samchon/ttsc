import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Asserts that `compilerOptions.plugins` supplied via `resolveOptions` is
 * applied even when the project's tsconfig carries no plugins.
 */
async function assertTransformUsesInlineCompilerOptions() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

/**
 * Asserts that the synthetic tsconfig written by `transformTtsc` is placed
 * outside the project root, verified by the fixture plugin's
 * `assert-temp-tsconfig-outside-project` operation.
 */
async function assertGeneratedTsconfigStaysOutsideProjectRoot() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "fixture",
            operation: "assert-temp-tsconfig-outside-project",
          },
        ],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

/**
 * Asserts that the object returned by `transformTtsc` does not include a `map`
 * property, preventing the adapter from overriding the bundler's source-map
 * pipeline with a fabricated map.
 */
async function assertTransformResultHasNoSyntheticSourceMap() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.equal("map" in result, false);
}

/**
 * Asserts that modifying the file being transformed causes the next
 * `transformTtsc` call to produce fresh output rather than a stale cache hit.
 */
async function assertTransformCacheInvalidatesOnSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const firstSource = TestUnpluginProject.mainSource(root);
  const first = await transformTtsc(
    file,
    firstSource,
    resolveOptions(),
    {},
    cache,
  );

  const secondSource =
    'export const value: string = goUpper("second");\nconsole.log(value);\n';
  fs.writeFileSync(file, secondSource, "utf8");
  const second = await transformTtsc(
    file,
    secondSource,
    resolveOptions(),
    {},
    cache,
  );

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN"/);
  assert.match(second.code, /"SECOND"/);
}

/**
 * Asserts that modifying a sibling source file (`src/helper.ts`) that the
 * plugin reads causes the next `transformTtsc` call to invalidate the cache and
 * produce updated output.
 */
async function assertTransformCacheInvalidatesOnProjectSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-helper",
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "src", "helper.ts");
  fs.writeFileSync(helper, "first\n", "utf8");
  const first = await transformTtsc(file, source, resolveOptions(), {}, cache);

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}

/**
 * Asserts that modifying a plugin-declared dependency file (`lib/helper.ts`)
 * causes the next `transformTtsc` call to invalidate the cache and produce
 * updated output.
 */
async function assertTransformCacheInvalidatesOnLibSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-configured-helper",
        path: "lib/helper.ts",
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "lib", "helper.ts");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.writeFileSync(helper, "first\n", "utf8");
  const first = await transformTtsc(file, source, resolveOptions(), {}, cache);

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}

/**
 * Asserts that `transformTtsc` resolves a relative `config` path on a plugin
 * descriptor to an absolute path before writing the temp tsconfig, verified by
 * the fixture plugin's `assert-config-path` operation.
 */
async function assertTransformAbsolutizesPluginConfigPaths() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  fs.writeFileSync(
    path.join(root, "fixture.config.json"),
    JSON.stringify({ ok: true }),
    "utf8",
  );
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "fixture",
            config: "./fixture.config.json",
            operation: "assert-config-path",
          },
        ],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

/**
 * Asserts that a plugin installed as a workspace package under `node_modules`
 * (written via `writePackagePlugin`) is auto-discovered and applied when no
 * explicit plugin list is provided.
 */
async function assertTransformUsesPackageDiscoveredProjectPlugins() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  TestUnpluginProject.writePackagePlugin(root, "fixture-auto");

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

export {
  assertGeneratedTsconfigStaysOutsideProjectRoot,
  assertTransformAbsolutizesPluginConfigPaths,
  assertTransformCacheInvalidatesOnLibSourceChange,
  assertTransformCacheInvalidatesOnProjectSourceChange,
  assertTransformCacheInvalidatesOnSourceChange,
  assertTransformResultHasNoSyntheticSourceMap,
  assertTransformUsesInlineCompilerOptions,
  assertTransformUsesPackageDiscoveredProjectPlugins,
};
