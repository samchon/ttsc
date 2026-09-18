import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun registers exactly the shared source extensions, excludes virtual
 * ids, and selects the matching TypeScript parser for every accepted spelling.
 *
 * A virtual id that reaches this callback would be treated as a filesystem
 * path. This assertion pins the filter boundary without assuming how another
 * Bun runtime plugin schedules or represents its own virtual modules.
 *
 * 1. Capture the loader and filter the Bun adapter registers in runtime mode.
 * 2. Assert the filter accepts the four TypeScript extensions and refuses
 *    JavaScript, other extensions, and a `\0`-prefixed virtual id.
 * 3. Load one file per accepted extension and assert the parser Bun is told to
 *    use.
 */
export async function test_bun_adapter_excludes_nul_virtual_ids(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const { loader, options } = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );

  for (const file of [
    "ordinary.ts",
    "ordinary.tsx",
    "ordinary.mts",
    "ordinary.cts",
  ]) {
    assert.equal(options.filter.test(`/project/src/${file}`), true, file);
  }
  for (const file of [
    "ordinary.js",
    "ordinary.jsx",
    "ordinary.mjs",
    "ordinary.cjs",
    "ordinary.mtsx",
    "ordinary.ctsx",
    "ordinary.css",
    "\0virtual.ts",
  ]) {
    assert.equal(options.filter.test(`/project/src/${file}`), false, file);
  }

  const root = TestUnpluginProject.createProject();
  for (const [extension, expected] of [
    [".ts", "ts"],
    [".tsx", "tsx"],
    [".mts", "ts"],
    [".cts", "ts"],
  ] as const) {
    const file = path.join(root, `loader${extension}`);
    const source = "export const value = 1;\n";
    fs.writeFileSync(file, source, "utf8");
    assert.deepEqual(await loader({ path: file }), {
      contents: source,
      loader: expected,
    });
  }
}
