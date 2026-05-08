import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

const { rollup } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup");

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
