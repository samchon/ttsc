import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies editing a sibling source the plugin reads invalidates the cache.
 *
 * A plugin can read a project source other than the one being transformed. That
 * file is a project input, so changing it must produce fresh output from the
 * same cache.
 *
 * 1. Transform the entry with a plugin that reads `src/helper.ts`.
 * 2. Rewrite `src/helper.ts`.
 * 3. Transform again and assert the output reflects the new content.
 */
export async function test_transformttsc_invalidates_project_cache_when_another_project_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-helper",
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "src", "helper.ts");
  fs.writeFileSync(helper, "first\n", "utf8");
  const first = await transformTtsc(file, source, resolveOptions(), {}, cache);

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}
