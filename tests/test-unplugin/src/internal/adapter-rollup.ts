import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

const { rollup } = TestUnpluginProject.requireFromUnplugin("rollup");

async function assertRollupAdapterTransformsSource() {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = TestUnpluginProject.createProject();
  const bundle = await rollup({
    input: TestUnpluginProject.mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    TestUnpluginProject.assertTransformedToPlugin(
      TestUnpluginProject.collectRollupOutputCode(generated.output),
    );
  } finally {
    await bundle.close();
  }
}

export { assertRollupAdapterTransformsSource };
