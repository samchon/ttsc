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
 *
 * @evidence contracts/testing.md#behavioral-verification transformTtsc selects the referenced app project, returns transformed PLUGIN code, and registers the routing solution config.
 * @evidence contracts/testing.md#independent-expectations The literal solution files-empty/references layout routes to the authored app config containing the source/plugin; PLUGIN/no-goUpper checks establish actual transformation.
 * @evidence contracts/testing.md#distinguishing-cases Nearest empty solution differs from owning referenced app; the routing config remains an input although it compiles no source.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_compiles_a_solution_layout_through_its_reference in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage transformTtsc selects the referenced app project, returns transformed PLUGIN code, and registers the routing solution config. These assertions remain in test_transformttsc_compiles_a_solution_layout_through_its_reference, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
