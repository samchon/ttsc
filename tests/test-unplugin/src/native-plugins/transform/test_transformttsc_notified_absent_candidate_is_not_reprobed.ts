import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies samchon/ttsc#1261: a delivery stops probing an absent resolution
 * candidate the generation's watcher already covers.
 *
 * A missing candidate is the one input no proof can be memoized for. Its
 * metadata cannot be read, so the signature that stands in for every other
 * input's comparison never applies, and each delivery that reaches it probes
 * the filesystem again — `modules x candidates` for one build, and the only
 * per-delivery filesystem work a declaring producer has left. Watching the name
 * answers it once for the whole generation instead, through the channel that
 * already proves project membership.
 *
 * 1. Build a project whose envelope stamps missing candidates.
 * 2. Deliver one module so the generation is captured, then reset the counters.
 * 3. Deliver the remaining modules and assert nothing touched a candidate path.
 *
 * @evidence contracts/testing.md#behavioral-verification After capture, sibling deliveries keep one native compile and perform zero filesystem calls at watched absent candidates.
 * @evidence contracts/testing.md#independent-expectations Independent wrappers count exists/lstat/read/stat/statBigInt only for the three literal candidate names.
 * @evidence contracts/testing.md#distinguishing-cases Absent candidate under valid notification bound is free; outside-root candidate case owns required reprobes.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_notified_absent_candidate_is_not_reprobed in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage After capture, sibling deliveries keep one native compile and perform zero filesystem calls at watched absent candidates. These assertions remain in test_transformttsc_notified_absent_candidate_is_not_reprobed, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_notified_absent_candidate_is_not_reprobed(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const graphCandidates = 3;
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates,
    graphFanout: 4,
  });
  const candidates = new Set(
    Array.from({ length: graphCandidates }, (_, index) =>
      path.resolve(
        path.join(project.root, "node_modules", `dep${index}`, "index.ts"),
      ),
    ),
  );
  const probes = { calls: 0 };
  const count = (location: string): void => {
    if (candidates.has(path.resolve(location))) probes.calls += 1;
  };
  const cache = createTtscTransformCache({
    exists: (location: string) => {
      count(location);
      return fs.existsSync(location);
    },
    lstat: (location: string) => {
      count(location);
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      count(location);
      return fs.readFileSync(location);
    },
    stat: (location: string) => {
      count(location);
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      count(location);
      return fs.statSync(location, { bigint: true });
    },
  });
  const modules = projectModules(project.root);
  const options = resolveOptions();
  const deliver = async (file: string): Promise<void> => {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
  };

  await deliver(modules[0]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);

  probes.calls = 0;
  for (const file of modules.slice(1)) {
    await deliver(file);
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  assert.equal(
    probes.calls,
    0,
    "a candidate the generation watches must cost no filesystem call per delivery",
  );
}
