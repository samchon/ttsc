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
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS round-trips source bytes and parseResult decodes the literal envelope through the compiled public WASM JavaScript entry.
 * @evidence contracts/testing.md#independent-expectations Public filesystem round-trip and JSON decoding contracts determine the literal source text and value object independently of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases A real host instance and one emitted result envelope pin exported helper assembly; descriptor, boot failure and malformed envelope decisions belong to source units.
 * @evidence contracts/testing.md#execution-ownership This named exported features entry runs the compiled package entry; authored source units own filesystem and host semantics.
 * @evidence contracts/e2e.md#necessary-boundary Compiled package exports and their runtime dependencies must be executable after TypeScript emission; direct authored-source units cannot detect a missing or unusable built export. This checks JavaScript assembly and makes no claim about a running Go WASM engine.
 * @evidence contracts/e2e.md#shared-execution The workspace build produces the artifact once. Both helper checks use that same imported module and one host, with no per-case install, native build or spawned host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The import is immutable for this invocation and the filesystem instance is test-local; no fixture cache or process state is shared across cases and no child needs termination.
 * @evidence contracts/e2e.md#preserved-coverage Both original public export calls and literal assertions remain; broader host and filesystem decision matrices retain their source-unit owners.
 */
export function test_built_package_entry_runs_its_public_functions(): void {
  const host = createMemFS();
  host.writeFile("/main.ts", "export const value = 1;\n");
  assert.equal(host.readFileText("/main.ts"), "export const value = 1;\n");
  assert.deepEqual(parseResult({ result: '{"value":1}' } as never), {
    value: 1,
  });
}
