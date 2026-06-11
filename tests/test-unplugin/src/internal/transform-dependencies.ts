import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

const { rollup } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup");

/**
 * Build the plugin descriptor list that routes the fixture plugin through the
 * `emit-dependencies` operation with the given dependency entries. Plugin
 * options live at the entry top level: the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object.
 */
function emitDependenciesPlugins(dependencies: string[]): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-dependencies",
      dependencies,
    },
  ];
}

/**
 * Asserts the transform forwards plugin-reported dependencies to the
 * `addWatchFile` hook: project-relative entries absolutized against the project
 * root, absolute entries kept, duplicates collapsed, and the transformed module
 * itself excluded.
 */
async function assertTransformForwardsDependenciesToWatchHook(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const absolute = path.join(root, "src", "absolute-types.d.ts");
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: emitDependenciesPlugins([
        "src/types.d.ts",
        absolute,
        "src/types.d.ts",
        "src/main.ts",
      ]),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  assert.deepEqual(watched, [path.join(root, "src", "types.d.ts"), absolute]);
}

/**
 * Asserts the negative twin: a transform whose plugin reports no `dependencies`
 * envelope field never invokes the watch hook.
 */
async function assertTransformWithoutDependenciesAddsNoWatchFiles(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual(watched, []);
}

/**
 * Asserts a cache-served transform still notifies the watch hook: watch
 * registrations are per build/module request, while the compiler result is
 * shared, so a cache hit must replay the dependency list.
 */
async function assertCachedTransformStillNotifiesWatchFiles(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  });
  const cache = createTtscTransformCache();
  const expected = [path.join(root, "src", "types.d.ts")];

  const first: string[] = [];
  await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => first.push(file) },
  );
  assert.deepEqual(first, expected);

  const second: string[] = [];
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => second.push(file) },
  );
  assert.ok(result);
  assert.deepEqual(second, expected);
}

/**
 * Asserts the adapter wiring end to end through a real rollup build: the
 * plugin-reported dependency lands in the bundle's `watchFiles`, which is the
 * exact channel watch-mode invalidation consumes.
 */
async function assertRollupBuildRegistersDependencyWatchFiles(): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = TestUnpluginProject.createProject({
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  });
  const bundle = await rollup({
    input: TestUnpluginProject.mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    TestUnpluginProject.assertTransformedToPlugin(
      TestUnpluginProject.collectRollupOutputCode(generated.output),
    );
    const expected = path.join(root, "src", "types.d.ts");
    assert.ok(
      bundle.watchFiles.some((file: string) => path.resolve(file) === expected),
      `watchFiles missing ${expected}: ${JSON.stringify(bundle.watchFiles)}`,
    );
  } finally {
    await bundle.close();
  }
}

export {
  assertCachedTransformStillNotifiesWatchFiles,
  assertRollupBuildRegistersDependencyWatchFiles,
  assertTransformForwardsDependenciesToWatchHook,
  assertTransformWithoutDependenciesAddsNoWatchFiles,
};
