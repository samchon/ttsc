import assert from "node:assert/strict";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls authored resolveOptions and transformTtsc with a NUL-prefixed rolldown id; asserts undefined before project/compiler work rather than a filesystem error or emitted module.
 * @evidence contracts/testing.md#independent-expectations Bundler virtual IDs represent no file, so the adapter must decline them. The literal undefined expectation follows that host contract without deriving an output from transformTtsc.
 * @evidence contracts/testing.md#distinguishing-cases Owns one virtual JavaScript spelling. Source/declaration classification counterexamples remain in the adapter-filter and transform declaration unit cases; this early-return case starts no compiler or product host.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_transformttsc_ignores_bundler_virtual_modules is discovered under src/features/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
 */
export async function test_transformttsc_ignores_bundler_virtual_modules(): Promise<void> {
  const result = await transformTtsc(
    "\0rolldown/runtime.js",
    "export {};",
    resolveOptions(),
  );

  assert.equal(result, undefined);
}
