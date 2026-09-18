import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Verifies editing the module being transformed produces fresh output instead
 * of a stale cache hit.
 *
 * The module's own source is the input the bundler supplies. A cache keyed only
 * by path would hand back the first output after the file changed.
 *
 * 1. Transform the entry through a cache.
 * 2. Rewrite the entry with different content.
 * 3. Transform again and assert the output reflects the new content.
 */
export async function test_transformttsc_invalidates_project_cache_when_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const firstSource = TestUnpluginProject.mainSource(root);
  const first = await transformTtsc(
    file,
    firstSource,
    resolveOptions(),
    {},
    cache,
  );

  const secondSource =
    'export const value: string = goUpper("second");\nconsole.log(value);\n';
  fs.writeFileSync(file, secondSource, "utf8");
  const second = await transformTtsc(
    file,
    secondSource,
    resolveOptions(),
    {},
    cache,
  );

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN"/);
  assert.match(second.code, /"SECOND"/);
}
