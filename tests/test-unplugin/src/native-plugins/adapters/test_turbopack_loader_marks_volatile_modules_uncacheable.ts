import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies the loader marks a plugin-declared volatile module uncacheable, and
 * never toggles cacheability otherwise.
 *
 * A volatile module's output depends on non-file inputs, which no
 * `fileDependencies` snapshot can represent. `cacheable(false)` is the only
 * loader-level channel that excludes it from caching, and calling it for an
 * ordinary module would disable caching for no reason.
 *
 * 1. Run the loader with a plugin that declares the module volatile.
 * 2. Assert the output is transformed and `cacheable(false)` was called once.
 * 3. Run it with an ordinary transform and assert `cacheable` was never called.
 */
export async function test_turbopack_loader_marks_volatile_modules_uncacheable(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const volatileRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "emit-volatile",
          volatile: ["src/main.ts"],
        },
      ],
    },
  });
  assert.match(volatileRun.content, /"PLUGIN:\d+"/);
  assert.deepEqual(volatileRun.cacheableCalls, [false]);

  const hermeticRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(hermeticRun.content);
  assert.deepEqual(hermeticRun.cacheableCalls, []);
}
