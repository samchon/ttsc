import {
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  mainFile,
  requireFromUnplugin,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginAdapter } from "@ttsc/testing/unplugin/unplugin";

const { rollup } = requireFromUnplugin("rollup");

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

export {
  assertRollupAdapterTransformsSource,
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  loadUnpluginAdapter,
  mainFile,
  requireFromUnplugin,
};
