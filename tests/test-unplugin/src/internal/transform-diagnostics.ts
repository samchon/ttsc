import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Asserts that `transformTtsc` rejects with a message containing the native
 * transform diagnostic when the source does not satisfy the plugin's contract.
 *
 * Creates a project whose source exports a plain string where the plugin
 * expects a `goUpper(...)` call, then verifies the rejection message matches
 * the expected diagnostic text.
 */
async function assertTransformReportsNativeDiagnostics() {
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

export { assertTransformReportsNativeDiagnostics };
