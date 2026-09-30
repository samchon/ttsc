import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies one project-walk failure during capture is recovered inside the same
 * shared generation.
 *
 * A directory that fails to list while the generation is captured leaves an
 * incomplete snapshot, which may never authorize reuse. One transient failure
 * should cost exactly one retry, and only the retry's complete generation may
 * settle in the cache.
 *
 * 1. Fail one directory listing once, after the compile has started.
 * 2. Deliver a module and assert the walk exercised the failure.
 * 3. Assert exactly one retry ran and the cached generation is the complete one.
 *
 * @evidence contracts/testing.md#behavioral-verification One injected listing failure triggers exactly two compiles, admits a complete snapshot and reuses its generation afterward.
 * @evidence contracts/testing.md#independent-expectations One-shot seam and independent failure flag identify the fault; literal hidden source ensures the directory matters.
 * @evidence contracts/testing.md#distinguishing-cases Transient failed walk differs from persistently failed walk; only complete retry may settle.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_incomplete_project_snapshot_retries_within_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage One injected listing failure triggers exactly two compiles, admits a complete snapshot and reuses its generation afterward. These assertions remain in test_transformttsc_incomplete_project_snapshot_retries_within_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_incomplete_project_snapshot_retries_within_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let failed = false;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        !failed &&
        fs.existsSync(project.runLog)
      ) {
        failed = true;
        throw new Error("transient project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(failed, true, "the generation walk must exercise the failure");
  const stableGeneration = [...cache.values()][0];
  assert.equal(
    (await stableGeneration)?.projectSnapshotComplete,
    true,
    "only the retry's complete generation may settle in the cache",
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "one transient walk failure must cost exactly one retry",
  );
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal([...cache.values()][0], stableGeneration);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
