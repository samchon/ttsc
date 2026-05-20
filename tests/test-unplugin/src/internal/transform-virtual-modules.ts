import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Asserts that `transformTtsc` returns `undefined` when the file path starts
 * with `\0` (a bundler virtual-module ID), skipping the transform entirely.
 *
 * Virtual modules do not correspond to real files and must not reach the ttsc
 * compiler, which would fail trying to read them from disk.
 */
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
