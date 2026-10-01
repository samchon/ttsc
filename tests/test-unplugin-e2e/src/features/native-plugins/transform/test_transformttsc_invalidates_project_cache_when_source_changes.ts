import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Verifies editing the module being transformed produces fresh output instead
 * of a stale cache hit.
 *
 * The module's own source is the input the bundler supplies. A cache keyed only
 * by path would hand back the first output after the file changed.
 *
 * 1. Transform the entry through a cache.
 * 2. Rewrite the entry with different content.
 * 3. Transform again and assert the output reflects the new content.
 *
 * @evidence contracts/testing.md#behavioral-verification Changing the delivered source on disk refreshes native output from PLUGIN to SECOND through one cache.
 * @evidence contracts/testing.md#independent-expectations Authored goUpper literals plugin and second independently establish changed output.
 * @evidence contracts/testing.md#distinguishing-cases Same module path with different content must not reuse old output; sibling and external edits have separate cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_when_source_changes in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Changing the delivered source on disk refreshes native output from PLUGIN to SECOND through one cache. These assertions remain in test_transformttsc_invalidates_project_cache_when_source_changes, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_when_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const firstSource = TestUnpluginProject.mainSource(root);
  const first = await transformTtsc(
    file,
    firstSource,
    resolveOptions(),
    {},
    cache,
  );

  const secondSource =
    'export const value: string = goUpper("second");\nconsole.log(value);\n';
  fs.writeFileSync(file, secondSource, "utf8");
  const second = await transformTtsc(
    file,
    secondSource,
    resolveOptions(),
    {},
    cache,
  );

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN"/);
  assert.match(second.code, /"SECOND"/);
}
