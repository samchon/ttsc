const test = require("node:test");

const {
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  mainFile,
  requireFromUnplugin,
} = require("./helpers/project.cjs");
const { loadUnpluginAdapter } = require("./helpers/unplugin.cjs");

const { rollup } = requireFromUnplugin("rollup");

test("rollup adapter runs the configured ttsc source transform", async () => {
  await assertRollupAdapterTransformsSource();
});

async function assertRollupAdapterTransformsSource() {
  const unpluginRollup = await loadUnpluginAdapter("rollup");
  const root = createProject();
  const bundle = await rollup({
    input: mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    assertTransformedToPlugin(collectRollupOutputCode(generated.output));
  } finally {
    await bundle.close();
  }
}
