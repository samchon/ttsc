import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a native plugin diagnostic rejects the transform with its message.
 *
 * A plugin that rejects a source reports a diagnostic through the host. The
 * adapter must surface it as a rejection carrying the diagnostic text, or the
 * bundler would show a generic failure that hides what the plugin said.
 *
 * 1. Create a project whose source exports a plain string where the plugin expects
 *    `goUpper(...)`.
 * 2. Transform the entry.
 * 3. Assert it rejects with the plugin's diagnostic.
 */
export async function test_transformttsc_reports_native_transform_diagnostics(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    source: 'export const value: string = "plain";\n',
  });

  await assert.rejects(
    () =>
      transformTtsc(
        TestUnpluginProject.mainFile(root),
        TestUnpluginProject.mainSource(root),
        resolveOptions(),
      ),
    /expected export const value = goUpper/,
  );
}
