import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `transformTtsc` returns `undefined` for a `\0`-prefixed virtual
 * module id.
 *
 * Virtual modules do not correspond to files, and the compiler would fail
 * trying to read one from disk. The transform must skip them before any project
 * work starts.
 *
 * 1. Resolve default options.
 * 2. Transform a `\0rolldown/runtime.js` id.
 * 3. Assert the result is `undefined`.
 */
export async function test_transformttsc_ignores_bundler_virtual_modules(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const result = await transformTtsc(
    "\0rolldown/runtime.js",
    "export {};",
    resolveOptions(),
  );

  assert.equal(result, undefined);
}
