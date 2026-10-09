import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";

/**
 * Verifies an external graph input changed and restored during a compile cannot
 * authorize the transient output.
 *
 * This is the out-of-walk twin of the project-input A-B-A race. An external
 * declaration rewritten and restored during the compile leaves identical
 * snapshots before and after, yet the output may have read the transient bytes,
 * so the attempt must be discarded before the generation resolves.
 *
 * 1. Open a pass over a project whose external declaration is rewritten and
 *    restored during the first compile.
 * 2. Deliver the entry and assert it never receives the discarded attempt.
 * 3. Deliver the sibling and assert the stable generation came from a second
 *    compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Build-scoped native external ABA mutation yields no EXTERNAL-DURING in entry or sibling, shares the stable generation, and costs exactly two compiles.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately stamps transient external bytes before restoration; forbidden output and independent run count identify discarded work.
 * @evidence contracts/testing.md#distinguishing-cases Outside-walk restored input is the external twin of in-walk ABA; both initial and later delivery refuse transient output.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output owns native build-pass external ABA capture and stable entry/sibling output assertions. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Build-scoped native external ABA mutation yields no EXTERNAL-DURING in entry or sibling, shares the stable generation, and costs exactly two compiles. These assertions remain in test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSnapshotAbaRace: true,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  const first = await transformTtsc(
    main,
    fs.readFileSync(main, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(first);
  assert.doesNotMatch(
    first.code,
    /EXTERNAL-DURING/,
    "the first delivery must never receive the discarded ABA attempt",
  );
  const stableGeneration = [...cache.values()][0];

  const second = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /EXTERNAL-DURING/);
  assert.equal(
    [...cache.values()][0],
    stableGeneration,
    "external ABA output must be discarded before the generation resolves",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
