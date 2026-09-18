import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createProjectWithExternalInput } from "../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies a persistent cache invalidates when a reported out-of-walk input
 * changes: the plugin reads a file outside the project root and reports it as a
 * dependency; editing only that file must produce regenerated output from the
 * same cache instance (no `buildStart` clear in between).
 */
export async function test_transformttsc_invalidates_project_cache_when_an_external_input_changes(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { external, relative, root } =
    createProjectWithExternalInput("first\n");
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
  assert.match(before.code, /PLUGIN:FIRST/);

  fs.writeFileSync(external, "second\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.match(after.code, /PLUGIN:SECOND/);
}
