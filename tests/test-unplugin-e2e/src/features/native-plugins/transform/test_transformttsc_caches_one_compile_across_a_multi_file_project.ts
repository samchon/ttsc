import assert from "node:assert/strict";

import { runProjectBuild } from "../../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies the shared project cache compiles a multi-file project once and
 * serves every other module from it.
 *
 * This is the happy-path baseline: a single persistent cache over N modules
 * must spawn the native transform once and serve the rest from the
 * whole-project result. Every output key sits inside the project walk here, and
 * the out-of-walk regression is pinned separately by
 * `test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key`.
 *
 * 1. Build a six-file project through one shared cache.
 * 2. Assert the plugin ran once.
 * 3. Assert all six outputs are transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification One shared transform cache delivers six PROBED outputs after one native fixture invocation.
 * @evidence contracts/testing.md#independent-expectations Six literal source markers and a one-byte-per-invocation run log establish output/count independently of adapter cache state.
 * @evidence contracts/testing.md#distinguishing-cases All six in-walk modules consume one generation; out-of-walk-key and source-output cases own external variants.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_caches_one_compile_across_a_multi_file_project in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage One shared transform cache delivers six PROBED outputs after one native fixture invocation. These assertions remain in test_transformttsc_caches_one_compile_across_a_multi_file_project, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_caches_one_compile_across_a_multi_file_project(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({ fileCount: 6 });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}
