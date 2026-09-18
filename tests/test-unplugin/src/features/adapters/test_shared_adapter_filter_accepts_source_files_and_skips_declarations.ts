import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the shared `transformInclude` predicate implements the complete
 * TypeScript source-extension and path-boundary contract.
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
