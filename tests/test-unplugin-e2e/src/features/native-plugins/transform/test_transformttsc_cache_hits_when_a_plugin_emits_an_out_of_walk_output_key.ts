import assert from "node:assert/strict";

import { runProjectBuild } from "../../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies the cache still hits when the transform output includes an entry
 * keyed outside the project walk (samchon/ttsc#252).
 *
 * The stored snapshot and the per-module validation snapshot must draw their
 * keys from the same project walk. The regression overlaid the compiler's
 * output keys, including `node_modules` declarations the validator never
 * re-hashes, on the store side only, so the snapshots never matched and the
 * whole project was re-transformed once per file. Any real project importing a
 * typed dependency triggers this.
 *
 * 1. Build a six-file project whose fixture emits one output key under
 *    `node_modules`.
 * 2. Transform every module through one persistent cache.
 * 3. Assert the plugin ran once and every output is transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification Six module deliveries retain one native invocation despite an emitted key below node_modules and all outputs contain PROBED.
 * @evidence contracts/testing.md#independent-expectations The fixture independently declares its extra key and run-log byte; six original markers require six transformed deliveries.
 * @evidence contracts/testing.md#distinguishing-cases Output-only key outside the validator walk must not enlarge snapshot membership; ordinary in-walk baseline is separate.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Six module deliveries retain one native invocation despite an emitted key below node_modules and all outputs contain PROBED. These assertions remain in test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({
    emitExternalKey: true,
    fileCount: 6,
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}
