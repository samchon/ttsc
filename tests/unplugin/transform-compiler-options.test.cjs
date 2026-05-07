const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc accepts compilerOptions.plugins as an inline override", async () => {
  await assertTransformUsesInlineCompilerOptions();
});

test("transformTtsc keeps generated tsconfig outside the project root", async () => {
  await assertGeneratedTsconfigStaysOutsideProjectRoot();
});

test("transformTtsc returns code without fabricated source maps", async () => {
  await assertTransformResultHasNoSyntheticSourceMap();
});

test("transformTtsc invalidates project cache when source changes", async () => {
  await assertTransformCacheInvalidatesOnSourceChange();
});

test("transformTtsc absolutizes relative plugin config paths in generated tsconfig", async () => {
  await assertTransformAbsolutizesPluginConfigPaths();
});

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
  const first = await transformTtsc(file, firstSource, resolveOptions(), {}, cache);

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
