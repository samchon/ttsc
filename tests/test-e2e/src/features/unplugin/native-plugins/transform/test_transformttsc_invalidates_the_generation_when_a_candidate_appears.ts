import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies the candidate relaxation keeps its own invalidation: a superseding
 * candidate that appears must still replace the generation.
 *
 * The recorded `missing` marker is state, not the absence of state, so the
 * negative twin of
 * `test_transformttsc_caches_one_compile_with_unproven_resolution_candidates`
 * is that creating the higher-priority spelling changes resolution and
 * therefore must recompile the project.
 *
 * 1. Deliver one module from a generation that recorded three missing candidates.
 * 2. Create the first candidate on disk.
 * 3. Deliver a sibling module and assert the plugin ran a second time.
 *
 * @evidence contracts/testing.md#behavioral-verification An initially missing candidate appearing on disk causes the next sibling delivery to record a second native compile.
 * @evidence contracts/testing.md#independent-expectations The native fixture reports three absent candidate names; planted index.ts and independent run log establish the transition.
 * @evidence contracts/testing.md#distinguishing-cases Stable absent candidate is reusable in the complementary candidate case; appearance changes that permission.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_the_generation_when_a_candidate_appears in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage An initially missing candidate appearing on disk causes the next sibling delivery to record a second native compile. These assertions remain in test_transformttsc_invalidates_the_generation_when_a_candidate_appears, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_the_generation_when_a_candidate_appears(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 3,
    graphCandidates: 3,
    graphFanout: 4,
  });
  const cache = createTtscTransformCache();
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
  const runsBefore = fs.readFileSync(project.runLog, "utf8").length;
  assert.equal(runsBefore, 1);
  const candidate = path.join(project.root, "node_modules", "dep0", "index.ts");
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  fs.writeFileSync(candidate, "export const superseding = 1;\n", "utf8");
  await deliver(modules[1]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
