import assert from "node:assert/strict";
import {
  assertTransformedToPlugin,
  createProject,
  requireFromUnplugin,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginAdapter } from "@ttsc/testing/unplugin/unplugin";

const esbuild = requireFromUnplugin("esbuild");

async function assertEsbuildAdapterTransformsSource() {
  const unpluginEsbuild = await loadUnpluginAdapter("esbuild");
  const root = createProject();
  const result = await esbuild.build({
    absWorkingDir: root,
    bundle: false,
    entryPoints: ["src/main.ts"],
    format: "cjs",
    logLevel: "silent",
    plugins: [unpluginEsbuild()],
    write: false,
  });

  assertTransformedToPlugin(result.outputFiles[0].text);
}

export {
  assert,
  assertEsbuildAdapterTransformsSource,
  assertTransformedToPlugin,
  createProject,
  esbuild,
  loadUnpluginAdapter,
  requireFromUnplugin,
};
