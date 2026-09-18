import { TestUnpluginRuntime } from "@ttsc/testing";
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
 */
export async function test_shared_adapter_filter_accepts_source_files_and_skips_declarations(): Promise<void> {
  const { unplugin } = await TestUnpluginRuntime.loadUnpluginApi();
  const raw = unplugin.raw(undefined, {});
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
