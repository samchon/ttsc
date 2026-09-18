import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `plugins: false` skips the transform and returns `undefined`.
 *
 * `plugins: false` is the documented way to disable ttsc for a host without
 * removing the adapter. It must skip the project entirely rather than run the
 * tsconfig's own plugins.
 *
 * 1. Create a project whose tsconfig declares the fixture plugin.
 * 2. Transform its entry with `plugins: false`.
 * 3. Assert the result is `undefined`.
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
