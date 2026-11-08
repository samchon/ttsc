import assert from "node:assert/strict";
import path from "node:path";

import unpluginBun from "../../../../../packages/unplugin/src/bun";
import { TestProject } from "../../../../utils/src/TestProject";
import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies the Bun `filter` option leaves unselected project modules to Bun
 * without resolving options early.
 *
 * `Bun.build` accepts an undefined `onLoad` result, but `Bun.plugin()` throws
 * on it in stable Bun, so a skipped module has to come back as its own source
 * and loader at runtime. The filter lives in the options, which register locks
 * on the first project module, so it may be read only after the in-memory and
 * `node_modules` checks that never reach the transform.
 *
 * 1. Capture bundler and runtime loaders for options whose project file does not
 *    exist, so reaching the transform is an error, with a filter selecting
 *    `selected.ts`.
 * 2. Assert the selected module rejects while the unselected one yields
 *    `undefined` in the bundler, without a read, and its exact source and `ts`
 *    loader at runtime.
 * 3. Capture provider-form loaders and count option resolutions for an in-memory
 *    bundler file, a runtime `node_modules` file, and repeated unselected
 *    modules.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Captured loaders reject a selected module that reaches the transform,
 *   return undefined for an unselected bundler module that does not exist on
 *   disk, and return its exact source with the ts loader at runtime; provider
 *   counts show no resolution for in-memory and node_modules files and one
 *   memoized resolution for unselected project modules.
 * @evidence contracts/testing.md#independent-expectations
 *   The nonexistent project file makes the transform observable without
 *   computing output, the authored literal source is the runtime byte oracle,
 *   and the provider counters are literal 0 and 1.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Selected versus unselected module, bundler versus runtime response,
 *   in-memory and node_modules files that must not lock options versus
 *   a project module that must, and a repeated unselected load that must not
 *   resolve again.
 * @evidence contracts/testing.md#execution-ownership
 *   The unit runner calls the authored source Bun factory through supported
 *   setup/onLoad collaborators and literal temporary files. The missing project
 *   file fails before any plugin evaluation or native producer is needed,
 *   so no built entry, native binary or Bun host runs. Stable-Bun acceptance
 *   of the runtime response remains with test_bun_filter_runs_under_real_bun.
 */
export async function test_bun_filter_leaves_unselected_modules_to_bun(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-bun-filter-unit-");
  const source = 'export const skipped: string = "kept";\n';
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"compilerOptions":{"plugins":[]},"include":["src"]}',
    "src/selected.ts": "export const selected: number = 1;\n",
    "src/skipped.ts": source,
    "src/skipped-again.ts": source,
    "node_modules/dependency/index.ts": source,
  });
  const selected = path.join(root, "src", "selected.ts");
  const skipped = path.join(root, "src", "skipped.ts");
  const unreadable = path.join(root, "src", "never-written.ts");
  const options = {
    filter: /[\\/]selected\.ts$/,
    plugins: [{ transform: "./plugin.cjs", name: "probe" }],
    project: path.join(root, "missing-tsconfig.json"),
  };

  const bundler = await captureBunLoader(unpluginBun(options), "bundler");
  await assert.rejects(
    bundler.loader({ path: selected }),
    /tsconfig not found/,
    "a selected module must reach the transform",
  );
  assert.equal(
    await bundler.loader({ path: unreadable }),
    undefined,
    "an unselected bundler module must be left to Bun without a read",
  );

  const runtime = await captureBunLoader(unpluginBun(options), "runtime");
  await assert.rejects(
    runtime.loader({ path: selected }),
    /tsconfig not found/,
    "a selected module must reach the transform at runtime",
  );
  assert.deepEqual(
    await runtime.loader({ path: skipped }),
    { contents: source, loader: "ts" },
    "an unselected runtime module must keep its source and TypeScript loader",
  );

  let bundlerResolutions = 0;
  const memory = await captureBunLoader(
    unpluginBun(() => {
      ++bundlerResolutions;
      return { filter: /never-matches$/, plugins: [] };
    }),
    "bundler",
    { files: { [skipped]: "export const memory = true;" } },
  );
  assert.equal(await memory.loader({ path: skipped }), undefined);
  assert.equal(
    bundlerResolutions,
    0,
    "a Bun in-memory file must not resolve or lock options",
  );

  let runtimeResolutions = 0;
  const provider = await captureBunLoader(
    unpluginBun(() => {
      ++runtimeResolutions;
      return { filter: /never-matches$/, plugins: [] };
    }),
    "runtime",
  );
  assert.deepEqual(
    await provider.loader({
      path: path.join(root, "node_modules", "dependency", "index.ts"),
    }),
    { contents: source, loader: "ts" },
  );
  assert.equal(
    runtimeResolutions,
    0,
    "a node_modules file must not resolve or lock options",
  );
  await provider.loader({ path: skipped });
  await provider.loader({ path: path.join(root, "src", "skipped-again.ts") });
  assert.equal(
    runtimeResolutions,
    1,
    "the first project module resolves options once, selected or not",
  );
}
