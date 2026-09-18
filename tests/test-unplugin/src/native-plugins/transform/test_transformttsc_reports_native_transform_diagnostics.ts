import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that `transformTtsc` rejects with a message containing the native
 * transform diagnostic when the source does not satisfy the plugin's contract.
 *
 * Creates a project whose source exports a plain string where the plugin
 * expects a `goUpper(...)` call, then verifies the rejection message matches
 * the expected diagnostic text.
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
