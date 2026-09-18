import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies a module the compiled program does not contain falls through the Bun
 * bundler adapter instead of failing the build.
 *
 * The Bun half of what samchon/ttsc#1308 asked to be proven per adapter had
 * never been proven (samchon/ttsc#1317). Its pass-through spelling is Bun's
 * own: the loader returns `undefined` to hand the module to the next loader, so
 * the source Bun compiles is the source on disk. The `undefined` alone would be
 * weak, because the loader returns it for an excluded path too. The stderr
 * report tells the two apart: only a delivery that reached the compile and
 * found no output for this file can emit it.
 *
 * 1. Create a real `.ts` file outside the tsconfig's `include`.
 * 2. Load it through the bundler-mode loader while capturing stderr.
 * 3. Assert the result is `undefined` and the report names both the module and the
 *    project's tsconfig.
 */
export async function test_bun_adapter_passes_through_an_out_of_program_module(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const stray = path.join(root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, "export const tool: string = 'STRAY';\n", "utf8");

  const { loader } = await captureBunLoader(unpluginBun(), "bundler");
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let result;
  try {
    result = await loader({ path: stray });
  } finally {
    process.stderr.write = original;
  }

  assert.equal(
    result,
    undefined,
    "a module outside the program must fall through, not fail the build",
  );
  assert.ok(
    captured.includes(stray) &&
      captured.includes(path.join(root, "tsconfig.json")),
    `the loader must have reached the program and reported the module (got ${JSON.stringify(captured)})`,
  );
}
