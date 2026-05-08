import assert from "node:assert/strict";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformReportsNativeDiagnostics() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({
    source: 'export const value: string = "plain";\n',
  });

  await assert.rejects(
    () => transformTtsc(mainFile(root), mainSource(root), resolveOptions()),
    /expected export const value = goUpper/,
  );
}

export {
  assert,
  assertTransformReportsNativeDiagnostics,
  createProject,
  loadUnpluginApi,
  mainFile,
  mainSource,
};
