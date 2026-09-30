import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a graph-free input changed and restored during a build-scoped
 * compile cannot authorize the transient output.
 *
 * The snapshot taken before the compile and the one after it are byte-identical
 * when an input is changed and then restored during the compile, yet the output
 * may have read the transient bytes. Only the mutation witness opened before
 * the compile can tell, and the generation must be discarded before it
 * resolves.
 *
 * 1. Open a pass over a graph-free project that rewrites and restores `mod1.ts`
 *    during its first compile.
 * 2. Deliver the entry, then the restored module.
 * 3. Assert the output carries no transient text, and the stable generation came
 *    from a second compile.
 *
 * @evidence contracts/testing.md#behavioral-verification A graph-free build pass rejects the changed-and-restored source attempt, delivers no DURING marker, and shares a two-compile stable generation.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately rewrites/restores PROBE and stamps transient output; original bytes, forbidden marker and invocation count are independent observations.
 * @evidence contracts/testing.md#distinguishing-cases Byte-identical before/after snapshots require a precompile mutation witness; stable sibling delivery must reuse the retry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A graph-free build pass rejects the changed-and-restored source attempt, delivers no DURING marker, and shares a two-compile stable generation. These assertions remain in test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 0,
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
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
    "an ABA mutation must be discarded before the generation resolves",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
