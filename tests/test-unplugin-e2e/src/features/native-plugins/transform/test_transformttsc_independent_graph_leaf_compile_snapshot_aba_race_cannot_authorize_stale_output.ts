import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies an A-B-A race on an independent graph leaf is discarded like any
 * other project input.
 *
 * A leaf with no graph edges is still a compiler input, so the proof that
 * discards a transiently changed and restored input must cover it too. Without
 * that, a leaf nothing else depends on would be the one place transient output
 * could settle.
 *
 * 1. Create a project whose independent leaf is rewritten and restored during the
 *    first compile.
 * 2. Deliver the entry, then the leaf.
 * 3. Assert the output carries no transient text, and the stable generation came
 *    from a second compile.
 *
 * @evidence contracts/testing.md#behavioral-verification An independent leaf restored after native ABA mutation yields no DURING output and shares a stable two-compile generation.
 * @evidence contracts/testing.md#independent-expectations Handwritten independentGraphLeaf and restored PROBE source independently identify the disconnected but actual compiler input.
 * @evidence contracts/testing.md#distinguishing-cases Leaf with no graph edges still needs mutation proof; reachable-input and external ABA cases cover other positions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage An independent leaf restored after native ABA mutation yields no DURING output and shares a stable two-compile generation. These assertions remain in test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 1,
    independentGraphLeaf: "src/mod1.ts",
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  const stableGeneration = [...cache.values()][0];
  assert.equal(
    fs.readFileSync(lazy, "utf8"),
    'export const value1: string = "PROBE";\n',
  );

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.doesNotMatch(result.code, /DURING/);
  assert.equal(
    [...cache.values()][0],
    stableGeneration,
    "an independent leaf race must stabilize before the first delivery",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
