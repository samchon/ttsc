import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitVolatilePlugins } from "../../internal/transform-volatile/emitVolatilePlugins";

/**
 * Verifies a file declared volatile bypasses the transform cache on every
 * request.
 *
 * A volatile output depends on something no file snapshot can represent, so
 * replaying the cache would serve stale output. Two transforms of an unchanged
 * project must compile twice, which the fixture's per-run timestamp makes
 * visible, and signal `markVolatile` each time.
 *
 * 1. Transform with a plugin that declares `src/main.ts` volatile, counting
 *    `markVolatile` calls.
 * 2. Transform again without changing anything.
 * 3. Assert the outputs differ and `markVolatile` was called for both.
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
