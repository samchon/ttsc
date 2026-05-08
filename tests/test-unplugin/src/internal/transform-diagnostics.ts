import assert from "node:assert/strict";
import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

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
