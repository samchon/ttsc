import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Plugin descriptor list routing the fixture plugin through the `emit-volatile`
 * operation: the plugin declares the given files volatile and embeds a per-run
 * nanosecond timestamp into its output, so a replayed cache entry is observably
 * stale.
 */
function emitVolatilePlugins(volatile: string[]): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-volatile",
      volatile,
    },
  ];
}

/**
 * Asserts a file the plugin declared volatile bypasses the project transform
 * cache: two consecutive transforms of an unchanged project must invoke the
 * compiler twice (observable through the embedded per-run timestamp) and signal
 * `markVolatile` on every request.
 */
async function assertVolatileFileBypassesTransformCache(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: emitVolatilePlugins(["src/main.ts"]),
  });
  const cache = createTtscTransformCache();

  let volatileSignals = 0;
  const hooks = {
    markVolatile: () => {
      volatileSignals += 1;
    },
  };
  const first = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    hooks,
  );
  const second = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    hooks,
  );

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:\d+"/);
  assert.match(second.code, /"PLUGIN:\d+"/);
  assert.notEqual(
    first.code,
    second.code,
    "a volatile file must re-run the transform instead of replaying the cache",
  );
  assert.equal(volatileSignals, 2);
}

/**
 * Asserts the negative twin: a transform without a `volatile` declaration never
 * signals `markVolatile` and keeps serving the unchanged project from the
 * cache.
 */
async function assertNonVolatileFileNeverSignalsVolatility(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: [
      { transform: "./plugin.cjs", name: "fixture", operation: "go-uppercase" },
    ],
  });
  const cache = createTtscTransformCache();

  let volatileSignals = 0;
  const hooks = {
    markVolatile: () => {
      volatileSignals += 1;
    },
  };
  const first = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    hooks,
  );
  const second = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    hooks,
  );

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.code, second.code);
  assert.equal(volatileSignals, 0);
}

export {
  assertNonVolatileFileNeverSignalsVolatility,
  assertVolatileFileBypassesTransformCache,
  emitVolatilePlugins,
};
