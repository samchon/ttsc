import assert from "node:assert/strict";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformAppliesOrderedPluginOverrides() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      plugins: [
        { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
        { transform: "./plugin.cjs", name: "upper" },
        { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
      ],
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"A:PLUGIN:Z"/);
}

export {
  assert,
  assertTransformAppliesOrderedPluginOverrides,
  createProject,
  loadUnpluginApi,
  mainFile,
  mainSource,
};
