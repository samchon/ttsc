import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies declared plugin inputs outside root discovery invalidate output.
 *
 * The project includes only src, so lib/helper.ts reaches the adapter through
 * the plugin dependency envelope. Reading it without reporting it would test an
 * undeclared input and accidentally depend on an over-broad project walk.
 *
 * 1. Read and report a helper outside include, then transform the entrypoint.
 * 2. Require the helper in the bundler watch inputs.
 * 3. Edit only the helper and require updated output from the same cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Reported lib helper is watched and native output changes from PLUGIN:FIRST to PLUGIN:SECOND after its edit.
 * @evidence contracts/testing.md#independent-expectations Literal lib dependency and helper contents establish required registration and read-helper output.
 * @evidence contracts/testing.md#distinguishing-cases Helper outside include but within project root must reach through explicit dependencies; delivered entry stays unchanged.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_when_lib_source_changes in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Reported lib helper is watched and native output changes from PLUGIN:FIRST to PLUGIN:SECOND after its edit. These assertions remain in test_transformttsc_invalidates_project_cache_when_lib_source_changes, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_when_lib_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-configured-helper",
        path: "lib/helper.ts",
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: ["lib/helper.ts"],
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "lib", "helper.ts");
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.writeFileSync(helper, "first\n", "utf8");
  const watched = new Set<string>();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
    {
      addWatchFile: (input: string) => {
        watched.add(path.resolve(input));
      },
    },
  );
  assert.ok(watched.has(helper), "the declared helper must be watched");

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}
