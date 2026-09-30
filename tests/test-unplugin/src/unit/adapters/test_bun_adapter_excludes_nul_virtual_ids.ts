import unpluginBun from "../../../../../packages/unplugin/src/bun";
import { TestProject } from "../../../../utils/src/TestProject";
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
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls the authored Bun adapter setup against a capturing onLoad interface,
 *   tests its registered filter and invokes its handler on real fixture bytes.
 *   Each accepted extension must retain those bytes and choose ts or tsx.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal extension spellings and Bun's documented TypeScript parser names
 *   determine the expectations independently of the registered filter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Four accepted source extensions contrast JavaScript families, adjacent
 *   invalid extensions, CSS and a NUL virtual ID. Empty plugin options make
 *   runtime source passthrough distinct from actual packed transform coverage.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported unit invokes authored setup and loader functions without Bun,
 *   native compilation or an installed package. TestProject owns temporary file
 *   cleanup; the packed Bun batch owns real host scheduling and preload loading.
 */
export async function test_bun_adapter_excludes_nul_virtual_ids(): Promise<void> {
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

  const root = TestProject.tmpdir("adapter-source-unit-");
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
