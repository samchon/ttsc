import { createMemFS, parseResult } from "@ttsc/wasm";
import assert from "node:assert/strict";

/**
 * Verifies the built WASM JavaScript entry exposes functioning host helpers.
 *
 * Source units cover host semantics; this boundary retains public runtime
 * exports after TypeScript compilation without starting a fake Go runtime.
 *
 * 1. Create a host through the built package and round-trip source bytes.
 * 2. Decode an envelope through the same public package entry.
 */
export const test_built_package_entry_runs_its_public_functions = (): void => {
  const host = createMemFS();
  host.writeFile("/main.ts", "export const value = 1;\n");
  assert.equal(host.readFileText("/main.ts"), "export const value = 1;\n");
  assert.deepEqual(parseResult({ result: '{"value":1}' } as never), {
    value: 1,
  });
};
