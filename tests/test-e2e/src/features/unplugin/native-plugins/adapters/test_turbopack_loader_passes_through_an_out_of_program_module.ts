import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTurbopackLoader } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies a module the compiled program does not contain passes through the
 * loader instead of failing the Turbopack build.
 *
 * Samchon/ttsc#1308 moved that decision into the shared core and asked for it
 * to be proven per adapter, which samchon/ttsc#1317 records never happened. The
 * file is a genuine transform target that the fixture's `include` leaves out,
 * and before #1308 the adapter threw on it. Returning the source unchanged is
 * also what the loader does for a filtered path, so the stderr report is what
 * proves the delivery reached the compile, and it is half the contract, since a
 * pass-through must not be silent.
 *
 * 1. Create a real `.ts` file outside the tsconfig's `include`.
 * 2. Run the loader on it while capturing stderr.
 * 3. Assert the source is unchanged and the report names both the module and the
 *    project's tsconfig.
 *
 * @evidence contracts/testing.md#behavioral-verification Real scripts/tool.ts outside include returns its original bytes and stderr names module and tsconfig.
 * @evidence contracts/testing.md#independent-expectations Literal supplied source and explicit warning distinguish pass-through from omission or silent filtering.
 * @evidence contracts/testing.md#distinguishing-cases Transformable extension outside program; ordinary transformed source has its own case.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_passes_through_an_out_of_program_module is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Turbopack callback reaches real native program with stderr captured; no Next process is required.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Temporary stderr writer is restored in finally; tracked roots end at process exit. Explicit per-case loader disposal is not asserted.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real scripts/tool.ts outside include returns its original bytes and stderr names module and tsconfig. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_passes_through_an_out_of_program_module(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const stray = path.join(root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  const source = "export const tool: string = 'STRAY';\n";
  fs.writeFileSync(stray, source, "utf8");

  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let content: string;
  try {
    content = await runTurbopackLoader({ resourcePath: stray, source });
  } finally {
    process.stderr.write = original;
  }

  assert.equal(
    content,
    source,
    "a module outside the program must pass through the loader unchanged",
  );
  assert.ok(
    captured.includes(stray) &&
      captured.includes(path.join(root, "tsconfig.json")),
    `the loader must have reached the program and reported the module (got ${JSON.stringify(captured)})`,
  );
}
