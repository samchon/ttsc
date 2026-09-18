import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a module in a solution layout is compiled by the project its
 * solution config references, and that the solution config is watched
 * (samchon/ttsc#1397).
 *
 * The create-vite `react-ts` layout keeps the plugins and sources in
 * `tsconfig.app.json` and leaves `tsconfig.json` with `"files": []` and
 * `references`. The adapter compiled the nearest config, an empty program, so
 * every typia call reached the runtime untransformed.
 *
 * 1. Move the fixture project's config to `tsconfig.app.json` and reference it
 *    from a solution `tsconfig.json`.
 * 2. Transform the entry module and assert it is transformed.
 * 3. Assert the solution config is among the registered watch inputs, since
 *    editing its `references` can re-route the module.
 */
export async function test_transformttsc_compiles_a_solution_layout_through_its_reference(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = fs.realpathSync.native(TestUnpluginProject.createProject());
  const solution = path.join(root, "tsconfig.json");
  fs.renameSync(solution, path.join(root, "tsconfig.app.json"));
  fs.writeFileSync(
    solution,
    JSON.stringify({
      files: [],
      references: [{ path: "./tsconfig.app.json" }],
    }),
  );
  const registered: string[] = [];
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    undefined,
    undefined,
    {
      addWatchFiles: (inputs: readonly { file: string }[]) => {
        for (const input of inputs) registered.push(path.resolve(input.file));
      },
    },
  );
  assert.ok(result, "the referenced project must compile the module");
  TestUnpluginProject.assertTransformedToPlugin(result.code);
  assert.ok(
    registered.includes(solution),
    "the solution config that routed the module is watched",
  );
}
