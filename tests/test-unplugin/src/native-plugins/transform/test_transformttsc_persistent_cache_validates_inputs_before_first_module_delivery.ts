import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a cache with no build-start lifecycle validates every generation
 * hit, including a module that generation has not served before.
 */
export async function test_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/lazy.ts",
      },
    ],
  });
  const lazy = path.join(root, "src", "lazy.ts");
  fs.writeFileSync(lazy, "export const lazy = 1;\n", "utf8");
  const cache = createTtscTransformCache();
  const options = resolveOptions();

  assert.ok(
    await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    ),
  );
  const oldGeneration = [...cache.values()][0];
  assert.ok(oldGeneration);

  fs.appendFileSync(path.join(root, "plugin.cjs"), "\n// changed input\n");
  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /ttsc-fixture/);
  assert.notEqual(
    [...cache.values()][0],
    oldGeneration,
    "a persistent cache must validate unrelated inputs before first delivery",
  );
}
