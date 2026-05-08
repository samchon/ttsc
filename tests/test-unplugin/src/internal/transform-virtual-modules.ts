import assert from "node:assert/strict";
import { TestUnpluginRuntime } from "@ttsc/testing";

async function assertTransformIgnoresVirtualModules() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const result = await transformTtsc(
    "\0rolldown/runtime.js",
    "export {};",
    resolveOptions(),
  );

  assert.equal(result, undefined);
}

export { assertTransformIgnoresVirtualModules };
