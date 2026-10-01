import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies an out-of-walk source that changes after the compiler read it is
 * discarded before any output is delivered.
 *
 * An out-of-walk source is proven through its own snapshot, not the walk. A
 * change after the compiler read it means the output may not match the recorded
 * bytes, so the raced attempt must be discarded and every delivery must share
 * its stable retry.
 *
 * 1. Create a project whose first external source changes after its compiler read
 *    on the first attempt.
 * 2. Deliver the entry.
 * 3. Assert the raced attempt was discarded and its stable retry is the shared
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification First native attempt reads an external source before it changes; stable external delivery contains PROBED-AFTER and shares exactly two compiles.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately changes its out-of-walk source after reading it; literal AFTER output and run bytes identify the stable retry.
 * @evidence contracts/testing.md#distinguishing-cases Outside-walk source is an actual output owner, contrasting graph-only declarations and persistent external changes.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_out_of_walk_source_change_stabilizes_within_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage First native attempt reads an external source before it changes; stable external delivery contains PROBED-AFTER and shares exactly two compiles. These assertions remain in test_transformttsc_out_of_walk_source_change_stabilizes_within_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_out_of_walk_source_change_stabilizes_within_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceChangesAfterRead: true,
    externalSourceOutputs: 1,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
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
  const external = externalSourceModules(project.root, 1)[0]!;
  const result = await transformTtsc(
    external,
    fs.readFileSync(external, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /PROBED-AFTER/);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the raced attempt must be discarded and its stable retry shared",
  );
}
