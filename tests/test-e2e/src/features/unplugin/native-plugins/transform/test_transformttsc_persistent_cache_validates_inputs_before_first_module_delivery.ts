import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a cache with no build lifecycle validates a generation hit even for
 * a module it never served.
 *
 * The constant-time first-delivery shortcut exists only inside a pass. Without
 * one, the first delivery of a module is just another request against a
 * generation that may be stale, so an input changed since the compile must
 * replace it.
 *
 * 1. Transform the entry through a persistent cache.
 * 2. Change the plugin descriptor.
 * 3. Deliver a module not served before and assert the generation was replaced.
 *
 * @evidence contracts/testing.md#behavioral-verification After descriptor edit, first delivery of lazy module returns its native echo and replaces the old generation without a build pass.
 * @evidence contracts/testing.md#independent-expectations Authored descriptor comment changes one universal input and generation inequality observes invalidation independently.
 * @evidence contracts/testing.md#distinguishing-cases Never-served module in persistent lifecycle cannot borrow build-pass first-delivery shortcut.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage After descriptor edit, first delivery of lazy module returns its native echo and replaces the old generation without a build pass. These assertions remain in test_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/lazy.ts",
      },
    ],
  });
  const lazy = path.join(root, "src", "lazy.ts");
  fs.writeFileSync(lazy, "export const lazy = 1;\n", "utf8");
  const cache = createTtscTransformCache();
  const options = resolveOptions();

  assert.ok(
    await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    ),
  );
  const oldGeneration = [...cache.values()][0];
  assert.ok(oldGeneration);

  fs.appendFileSync(path.join(root, "plugin.cjs"), "\n// changed input\n");
  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /ttsc-fixture/);
  assert.notEqual(
    [...cache.values()][0],
    oldGeneration,
    "a persistent cache must validate unrelated inputs before first delivery",
  );
}
