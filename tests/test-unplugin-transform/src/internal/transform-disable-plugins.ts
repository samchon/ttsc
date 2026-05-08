import assert from "node:assert/strict";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformSkipsProjectPlugins() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({
    source: 'export const value: string = "plugin";\n',
  });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({ plugins: false }),
  );

  assert.equal(result, undefined);
}

export {
  assert,
  assertTransformSkipsProjectPlugins,
  createProject,
  loadUnpluginApi,
  mainFile,
  mainSource,
};
