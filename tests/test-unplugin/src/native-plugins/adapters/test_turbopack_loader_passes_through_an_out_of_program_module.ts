import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies a module the compiled program does not contain passes through the
 * loader instead of failing the Turbopack build.
 *
 * Samchon/ttsc#1308 moved that decision into the shared core so every adapter
 * answers it once, and asked for it to be proven per adapter rather than for
 * the core alone; samchon/ttsc#1317 records that it never was. The core case
 * pins the report and the once-per-pass rule, and this pins the outcome at the
 * boundary that actually reaches a bundler.
 *
 * The discriminator is the absence of a throw. This file is a genuine transform
 * target — a real `.ts` under the project root, outside `node_modules`, not a
 * declaration — so no filter turns it away; it is simply absent from the
 * program, because the fixture's tsconfig includes `src` alone. Before #1308
 * the adapter threw here and Turbopack turned that into a build failure.
 *
 * Returning the source unchanged is on its own a weak assertion, because it is
 * also what the loader does for a path its filter rejects — so a case resting
 * on it alone would keep passing if the module stopped reaching the transform
 * at all, and would then prove nothing about the program. The report is what
 * distinguishes them: only a delivery that reached the compile and found no
 * output for this file can emit it, so asserting it pins that the pass-through
 * happened for the stated reason. It is also half the contract, since passing
 * through must not be silent.
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
