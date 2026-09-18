import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitVolatilePlugins } from "../../internal/transform-volatile/emitVolatilePlugins";

/**
 * Verifies a file the plugin declared volatile bypasses the project transform
 * cache: two consecutive transforms of an unchanged project must invoke the
 * compiler twice (observable through the embedded per-run timestamp) and signal
 * `markVolatile` on every request.
 */
export async function test_transformttsc_volatile_file_bypasses_the_transform_cache(): Promise<void> {
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
