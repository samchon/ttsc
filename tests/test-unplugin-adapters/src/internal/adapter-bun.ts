import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

async function assertBunAdapterTransformsSource() {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const loaders = [];
  unpluginBun().setup({
    onLoad(options, loader) {
      loaders.push({ loader, options });
    },
  });

  const [{ loader, options }] = loaders;
  if (!options.filter.test(TestUnpluginProject.mainFile(root))) {
    throw new Error("Bun adapter did not register a TypeScript source filter");
  }
  const result = await loader({ path: TestUnpluginProject.mainFile(root) });
  TestUnpluginProject.assertTransformedToPlugin(result.contents);
}

export { assertBunAdapterTransformsSource };
