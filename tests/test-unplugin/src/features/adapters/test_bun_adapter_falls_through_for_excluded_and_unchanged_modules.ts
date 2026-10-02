import assert from "node:assert/strict";
import path from "node:path";

import unpluginBun from "../../../../../packages/unplugin/src/bun";
import { TestProject } from "../../../../utils/src/TestProject";
import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun's bundler and runtime preserve ownership of unchanged source.
 *
 * Bun stops at the first `onLoad` callback that returns a value. The adapter's
 * broad TypeScript filter therefore must consult the shared `transformInclude`
 * predicate before reading and return `undefined` when the path is excluded or
 * the transform produced no code. Runtime mode instead returns the unchanged
 * source with an explicit TypeScript loader.
 *
 * 1. Capture the bundler-mode loader of the Bun adapter.
 * 2. Load a `node_modules` source that does not exist, and assert `undefined`
 *    without a read.
 * 3. Load the entry of a project with no plugins, and assert `undefined` so Bun's
 *    built-in TypeScript loader takes it.
 * 4. Deliver the same entry through runtime mode and assert its exact bytes and
 *    `ts` loader.
 *
 * @evidence contracts/testing.md#behavioral-verification Captured bundler onLoad returns undefined for a nonexistent node_modules path and a plugin-free entry; runtime onLoad returns the exact unchanged source and ts loader. These distinguish an unwanted disk read, bundler loader-chain capture and lost runtime source.
 * @evidence contracts/testing.md#independent-expectations Bun bundler fall-through is undefined; the absent excluded file would fail any read. The authored literal source supplies the independent runtime-byte oracle and the .ts input requires the ts loader.
 * @evidence contracts/testing.md#distinguishing-cases Excluded nonexistent source versus included source with no rewrite, and bundler undefined versus runtime's explicit unchanged-source response.
 * @evidence contracts/testing.md#execution-ownership The unit runner calls the authored source Bun factory through supported setup/onLoad collaborators and literal temporary files. Plugin options are empty for every disk load, so no native producer, built entry or Bun host runs. Real registration and ambient ownership remain in test_bun_native_host_owns_build_and_runtime_sessions.
 */
export async function test_bun_adapter_falls_through_for_excluded_and_unchanged_modules(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-bun-fallthrough-unit-");
  const source =
    'export const value: string = goUpper("plugin");\nconsole.log(value);\n';
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"compilerOptions":{"plugins":[]},"include":["src"]}',
    "src/main.ts": source,
  });
  const { loader } = await captureBunLoader(
    unpluginBun({
      plugins: [],
    }),
    "bundler",
  );

  assert.equal(
    await loader({
      path: path.join(root, "node_modules", "missing", "index.ts"),
    }),
    undefined,
    "an excluded path must not be read or claim the loader chain",
  );

  assert.equal(
    await loader({ path: path.join(root, "src", "main.ts") }),
    undefined,
    "a no-op transform must fall through to Bun's built-in TypeScript loader",
  );

  const runtime = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );
  assert.deepEqual(
    await runtime.loader({ path: path.join(root, "src", "main.ts") }),
    { contents: source, loader: "ts" },
    "runtime mode must retain the exact source bytes and its TypeScript loader",
  );
}
