import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies declared plugin inputs outside root discovery invalidate output.
 *
 * The project includes only src, so lib/helper.ts reaches the adapter through
 * the plugin dependency envelope. Reading it without reporting it would test an
 * undeclared input and accidentally depend on an over-broad project walk.
 *
 * 1. Read and report a helper outside include, then transform the entrypoint.
 * 2. Require the helper in the bundler watch inputs.
 * 3. Edit only the helper and require updated output from the same cache.
 */
export async function test_transformttsc_invalidates_project_cache_when_lib_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-configured-helper",
        path: "lib/helper.ts",
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: ["lib/helper.ts"],
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "lib", "helper.ts");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.writeFileSync(helper, "first\n", "utf8");
  const watched = new Set<string>();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
    {
      addWatchFile: (input: string) => {
        watched.add(path.resolve(input));
      },
    },
  );
  assert.ok(watched.has(helper), "the declared helper must be watched");

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}
