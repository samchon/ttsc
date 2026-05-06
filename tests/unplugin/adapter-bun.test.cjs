const test = require("node:test");

const unpluginBun = require("../../packages/unplugin/lib/bun.js").default;
const {
  assertTransformedToPlugin,
  createProject,
  mainFile,
} = require("./helpers/project.cjs");

test("bun adapter registers an onLoad transformer for TypeScript sources", async () => {
  await assertBunAdapterTransformsSource();
});

async function assertBunAdapterTransformsSource() {
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
