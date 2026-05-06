const test = require("node:test");

const {
  assertTransformedToPlugin,
  createProject,
  mainFile,
} = require("./helpers/project.cjs");
const { loadUnpluginAdapter } = require("./helpers/unplugin.cjs");

test("bun adapter registers an onLoad transformer for TypeScript sources", async () => {
  await assertBunAdapterTransformsSource();
});

async function assertBunAdapterTransformsSource() {
  const unpluginBun = await loadUnpluginAdapter("bun");
  const root = createProject();
  const loaders = [];
  unpluginBun().setup({
    onLoad(options, loader) {
      loaders.push({ loader, options });
    },
  });

  const [{ loader, options }] = loaders;
  if (!options.filter.test(mainFile(root))) {
    throw new Error("Bun adapter did not register a TypeScript source filter");
  }
  const result = await loader({ path: mainFile(root) });
  assertTransformedToPlugin(result.contents);
}
