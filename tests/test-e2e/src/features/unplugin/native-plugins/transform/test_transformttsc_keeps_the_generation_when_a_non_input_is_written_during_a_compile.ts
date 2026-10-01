import assert from "node:assert/strict";

import { runProjectBuild } from "../../../../internal/unplugin/internal/transform-project-cache/runProjectBuild";

/**
 * Verifies samchon/ttsc#1246: a file written inside the project root during a
 * compile does not cost the generation when it is not an input of that
 * compile.
 *
 * A project root is a working directory. A framework's generated types, a
 * coverage report, a log, or a test artifact appears and changes there while a
 * compile runs, and comparing every walked file made those generations
 * incoherent, which cost a whole-project recompile per delivered module. Only a
 * declared input can change an output; files entering or leaving the project
 * stay covered by the directory-membership snapshot.
 *
 * 1. Build a six-file project whose fixture transform rewrites
 *    `fixtures/build.log` (never an input) on every run.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification Six module deliveries retain one native compile while each invocation rewrites fixtures/build.log.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately writes a preexisting noninput and appends an independent run byte; six outputs retain all deliveries.
 * @evidence contracts/testing.md#distinguishing-cases Noninput content mutation during compile differs from admitted source or directory membership changes; this case does not assert each output marker.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Six module deliveries retain one native compile while each invocation rewrites fixtures/build.log. These assertions remain in test_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({
    fileCount: 6,
    graphFanout: 4,
    nonInputRaceFile: "fixtures/build.log",
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
}
