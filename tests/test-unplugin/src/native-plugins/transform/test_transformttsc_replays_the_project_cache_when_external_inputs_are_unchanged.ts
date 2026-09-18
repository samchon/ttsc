import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { createProjectWithExternalInput } from "../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies an untouched external input lets the second transform replay the
 * cached generation.
 *
 * This is the negative twin of external invalidation. Re-hashing the external
 * input on every call must not turn the cache into a per-call recompile, so the
 * second transform has to return the same cached promise.
 *
 * 1. Transform with a plugin that reads and reports a file outside the project.
 * 2. Transform again without touching that file.
 * 3. Assert the same generation was replayed.
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
