import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a transform without a `volatile` declaration never calls
 * `markVolatile` and keeps serving from the cache.
 *
 * `markVolatile` makes a host exclude a module from caching. Signaling it
 * without a declaration would disable caching for every module, so an ordinary
 * transform must never call it.
 *
 * 1. Transform the entry twice through one cache with a plain plugin and a
 *    `markVolatile` counter.
 * 2. Assert both outputs are identical.
 * 3. Assert `markVolatile` was never called.
 */
export async function test_transformttsc_never_signals_volatility_without_a_declaration(): Promise<void> {
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
