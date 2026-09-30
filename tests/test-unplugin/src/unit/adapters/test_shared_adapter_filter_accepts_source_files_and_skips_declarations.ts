import { unplugin } from "../../../../../packages/unplugin/src/core/unplugin";
import assert from "node:assert/strict";

/**
 * Verifies the shared `transformInclude` predicate accepts exactly the
 * TypeScript sources a whole-project transform can produce.
 *
 * Every unplugin adapter routes modules through this one predicate, so it
 * decides which modules can reach the compiler at all. A declaration file, a
 * package under `node_modules`, or a virtual id has no transformed output to
 * return, while a JavaScript module is not a TypeScript source.
 *
 * 1. Create the raw unplugin hooks.
 * 2. Assert `.ts`, `.tsx`, `.mts`, and `.cts` sources are included.
 * 3. Assert JavaScript, unknown extensions, every declaration spelling,
 *    `node_modules` sources, and a `\0` virtual id are excluded.
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls the authored unplugin raw transformInclude predicate and asserts the four TypeScript source extensions are admitted while JavaScript, virtual IDs, declarations and node_modules are refused.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal source/declaration spellings derive from the supported whole-project transformation contract. The expected booleans are independent of the predicate implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes ts, tsx, mts and cts positive cases plus adjacent mtsx/ctsx, JavaScript families, CSS, declaration families, vendored TypeScript and a NUL virtual identifier; false positives and false negatives each fail explicitly.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported unit calls authored raw hooks directly through the unit runner; it installs no consumer, builds no native artifact and starts no host. Packed hosts independently own actual registration and transformed delivery.
 */
export async function test_shared_adapter_filter_accepts_source_files_and_skips_declarations(): Promise<void> {
  const raw = unplugin.raw(undefined, { framework: "rollup" });
  for (const id of ["main.ts", "main.tsx", "main.mts", "main.cts"]) {
    assert.equal(raw.transformInclude?.(id), true, id);
  }
  for (const id of [
    "main.js",
    "main.jsx",
    "main.mjs",
    "main.cjs",
    "main.mtsx",
    "main.ctsx",
    "main.css",
    "main.d.ts",
    "main.d.mts",
    "main.d.cts",
    "main.d.css.ts",
    "node_modules/pkg/main.ts",
    "node_modules/pkg/main.mts",
    "\0virtual.ts",
  ]) {
    assert.equal(raw.transformInclude?.(id), false, id);
  }
}
