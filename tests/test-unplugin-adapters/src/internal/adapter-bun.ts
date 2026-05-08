import {
  assertTransformedToPlugin,
  createProject,
  mainFile,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginAdapter } from "@ttsc/testing/unplugin/unplugin";

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

export {
  assertBunAdapterTransformsSource,
  assertTransformedToPlugin,
  createProject,
  loadUnpluginAdapter,
  mainFile,
};
