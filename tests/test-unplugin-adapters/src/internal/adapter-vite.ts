import path from "node:path";
import {
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  requireFromUnplugin,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginAdapter } from "@ttsc/testing/unplugin/unplugin";

const { build: viteBuild } = requireFromUnplugin("vite");

async function assertViteAdapterTransformsSource() {
  const unpluginVite = await loadUnpluginAdapter("vite");
  const root = createProject();
  const output = await viteBuild({
    root,
    build: {
      minify: false,
      rollupOptions: {
        input: path.join(root, "src", "main.ts"),
      },
      write: false,
    },
    logLevel: "silent",
    plugins: [unpluginVite()],
  });

  const chunks = Array.isArray(output)
    ? output.flatMap((entry) => entry.output)
    : output.output;
  assertTransformedToPlugin(collectRollupOutputCode(chunks));
}

export {
  assertTransformedToPlugin,
  assertViteAdapterTransformsSource,
  collectRollupOutputCode,
  createProject,
  loadUnpluginAdapter,
  path,
  requireFromUnplugin,
};
