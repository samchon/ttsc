import assert from "node:assert/strict";
import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformSkipsProjectPlugins() {
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

export { assertTransformSkipsProjectPlugins };
