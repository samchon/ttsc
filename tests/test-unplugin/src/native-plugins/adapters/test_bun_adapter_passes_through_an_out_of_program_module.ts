import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies a module the compiled program does not contain falls through the Bun
 * bundler adapter instead of failing the build.
 *
 * The Bun half of what samchon/ttsc#1308 asked to be proven per adapter and
 * samchon/ttsc#1317 records was never proven. Its pass-through spelling is
 * Bun's own: the bundler loader returns `undefined` to hand the module to the
 * next loader, exactly as it does for a transform that changed nothing, so the
 * source Bun compiles is the source on disk.
 *
 * The discriminator is the absence of a throw rather than the `undefined`
 * itself. This file is a genuine transform target — a real `.ts` under the
 * project root, outside `node_modules` — and is absent from the program only
 * because the fixture's tsconfig includes `src` alone. Before #1308 that threw
 * and Bun turned it into a build failure.
 *
 * The `undefined` alone would be a weak assertion, because the loader returns
 * it for an excluded path too: `options.filter` is only the coarse pattern
 * `onLoad` is registered with, and the real gate is `isTransformTarget` inside
 * the loader, so a case resting on the return value would keep passing if the
 * module stopped reaching the transform at all and would decay into
 * {@link assertBunAdapterFallsThroughWhenItDoesNotTransform}'s excluded-path
 * row. The report is what tells the two apart: only a delivery that reached the
 * compile and found no output for this file can emit it.
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
