import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

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
