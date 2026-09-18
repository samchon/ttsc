import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { createProjectWithExternalInput } from "../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies the negative twin: with the external input untouched, the second
 * transform replays the cached generation (same promise identity) instead of
 * recompiling — the external re-hash must not turn the cache into a per-call
 * recompile.
 */
export async function test_transformttsc_replays_the_project_cache_when_external_inputs_are_unchanged(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { relative, root } = createProjectWithExternalInput("first\n");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
    ],
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  const generation = cacheEntry(cache);

  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.equal(after.code, before.code);
  assert.strictEqual(cacheEntry(cache), generation);
}
