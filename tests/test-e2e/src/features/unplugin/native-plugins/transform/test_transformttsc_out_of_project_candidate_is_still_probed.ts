import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a candidate whose spelling leaves the project subtree is still
 * probed.
 *
 * The negative twin of the notification proof at the boundary it declines at.
 * The chain that proves an absent candidate stops at the project's own root:
 * above that line the components belong to the machine rather than the project,
 * and a link along the part outside the subtree could move the candidate's
 * answer with nothing inside the bound to report it. Such a candidate therefore
 * keeps the probe it always had, and claiming it anyway would serve a
 * generation the appearance already superseded (samchon/ttsc#1261).
 *
 * 1. Stamp one candidate at an absolute spelling outside the project root, with
 *    watch registration left working so only the bound decides.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert that spelling was checked every time.
 *
 * @evidence contracts/testing.md#behavioral-verification Every postcapture sibling delivery probes the outside-root candidate while retaining one native compile.
 * @evidence contracts/testing.md#independent-expectations Independent wrappers count calls at the literal outside candidate; per-delivery increase requires a fresh observation rather than one aggregate probe.
 * @evidence contracts/testing.md#distinguishing-cases Unbounded outside spelling cannot inherit project notification trust; inside-root watched absence is the negative twin.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_out_of_project_candidate_is_still_probed in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Every postcapture sibling delivery probes the outside-root candidate while retaining one native compile. These assertions remain in test_transformttsc_out_of_project_candidate_is_still_probed, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_out_of_project_candidate_is_still_probed(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const outside = path.join(
    TestProject.tmpdir("ttsc-unplugin-outside-candidate-"),
    "index.ts",
  );
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    outOfProjectCandidate: outside,
  });
  const probes = { calls: 0 };
  const count = (location: string): void => {
    if (path.resolve(location) === path.resolve(outside)) probes.calls += 1;
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
    const before = probes.calls;
    await deliver(file);
    assert.ok(
      probes.calls > before,
      `expected an outside candidate probe for ${file}`,
    );
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  assert.ok(
    probes.calls > 0,
    "a candidate outside the project subtree must keep being checked on the filesystem",
  );
}
