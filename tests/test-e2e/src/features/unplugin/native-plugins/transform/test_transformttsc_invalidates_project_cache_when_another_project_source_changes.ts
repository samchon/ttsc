import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies editing a sibling source the plugin reads invalidates the cache.
 *
 * A plugin can read a project source other than the one being transformed. That
 * file is a project input, so changing it must produce fresh output from the
 * same cache.
 *
 * 1. Transform the entry with a plugin that reads `src/helper.ts`.
 * 2. Rewrite `src/helper.ts`.
 * 3. Transform again and assert the output reflects the new content.
 *
 * @evidence contracts/testing.md#behavioral-verification Native plugin reading helper source emits PLUGIN:FIRST then PLUGIN:SECOND from one cache after helper edit.
 * @evidence contracts/testing.md#independent-expectations Authored helper bytes first/second are independent output expectations of the read-helper operation.
 * @evidence contracts/testing.md#distinguishing-cases Sibling input changes while delivered module and options remain fixed; own-module edits are separate.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_when_another_project_source_changes in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native plugin reading helper source emits PLUGIN:FIRST then PLUGIN:SECOND from one cache after helper edit. These assertions remain in test_transformttsc_invalidates_project_cache_when_another_project_source_changes, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_when_another_project_source_changes(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "read-helper",
      },
    ],
  });
  const cache = createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const helper = path.join(root, "src", "helper.ts");
  fs.writeFileSync(helper, "first\n", "utf8");
  const first = await transformTtsc(file, source, resolveOptions(), {}, cache);

  fs.writeFileSync(helper, "second\n", "utf8");
  const second = await transformTtsc(file, source, resolveOptions(), {}, cache);

  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /"PLUGIN:FIRST"/);
  assert.match(second.code, /"PLUGIN:SECOND"/);
}
