import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun runtime pass-through satisfies its stricter loader contract.
 *
 * Unlike `Bun.build`, `Bun.plugin()` rejects an `onLoad` result of `undefined`.
 * Excluded or unchanged TypeScript must therefore be returned explicitly with
 * its loader instead of using the bundler's next-loader signal.
 */
export async function test_bun_runtime_passes_through_unchanged_source(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const file = TestUnpluginProject.mainFile(root);
  const source = fs.readFileSync(file, "utf8");
  const { loader } = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );

  assert.deepEqual(await loader({ path: file }), {
    contents: source,
    loader: "ts",
  });
}
