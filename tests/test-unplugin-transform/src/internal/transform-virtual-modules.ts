import assert from "node:assert/strict";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformIgnoresVirtualModules() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const result = await transformTtsc(
    "\0rolldown/runtime.js",
    "export {};",
    resolveOptions(),
  );

  assert.equal(result, undefined);
}

export { assert, assertTransformIgnoresVirtualModules, loadUnpluginApi };
