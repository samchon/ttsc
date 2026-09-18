import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that `transformTtsc` returns `undefined` when `plugins: false` is
 * passed, meaning the transform is skipped entirely without running any project
 * plugins.
 */
export async function test_transformttsc_leaves_source_unchanged_when_plugins_are_disabled(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    source: 'export const value: string = "plugin";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({ plugins: false }),
  );

  assert.equal(result, undefined);
}
