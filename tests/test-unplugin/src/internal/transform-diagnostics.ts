import assert from "node:assert/strict";
import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

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
