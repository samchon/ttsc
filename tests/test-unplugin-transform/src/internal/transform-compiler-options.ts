import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProject,
  mainFile,
  mainSource,
  writePackagePlugin,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformUsesInlineCompilerOptions() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

async function assertGeneratedTsconfigStaysOutsideProjectRoot() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
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

async function assertTransformResultHasNoSyntheticSourceMap() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.equal("map" in result, false);
}

async function assertTransformCacheInvalidatesOnSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await loadUnpluginApi();
  const root = createProject();
  const cache = createTtscTransformCache();
  const file = mainFile(root);
  const firstSource = mainSource(root);
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

async function assertTransformCacheInvalidatesOnProjectSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await loadUnpluginApi();
  const root = createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-helper",
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = mainFile(root);
  const source = mainSource(root);
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

async function assertTransformCacheInvalidatesOnLibSourceChange() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await loadUnpluginApi();
  const root = createProject({
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
  const file = mainFile(root);
  const source = mainSource(root);
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

async function assertTransformAbsolutizesPluginConfigPaths() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  fs.writeFileSync(
    path.join(root, "fixture.config.json"),
    JSON.stringify({ ok: true }),
    "utf8",
  );
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
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

async function assertTransformUsesPackageDiscoveredProjectPlugins() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  writePackagePlugin(root, "fixture-auto");

  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

export {
  assert,
  assertGeneratedTsconfigStaysOutsideProjectRoot,
  assertTransformAbsolutizesPluginConfigPaths,
  assertTransformCacheInvalidatesOnLibSourceChange,
  assertTransformCacheInvalidatesOnProjectSourceChange,
  assertTransformCacheInvalidatesOnSourceChange,
  assertTransformResultHasNoSyntheticSourceMap,
  assertTransformUsesInlineCompilerOptions,
  assertTransformUsesPackageDiscoveredProjectPlugins,
  createProject,
  fs,
  loadUnpluginApi,
  mainFile,
  mainSource,
  path,
  writePackagePlugin,
};
