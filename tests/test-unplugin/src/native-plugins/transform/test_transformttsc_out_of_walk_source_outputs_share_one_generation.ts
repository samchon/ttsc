import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies transformable outputs outside the walk share the project's one
 * generation.
 *
 * A whole-project transform can emit sources that live outside the walk, under
 * `node_modules` here. Delivering one of them must be served from the same
 * generation instead of treated as a separate project.
 *
 * 1. Create a project that emits two transformable outputs under `node_modules`.
 * 2. Deliver the entry and both external sources.
 * 3. Assert each is transformed and the project compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification Entry plus two transformable node_modules sources all return PROBED from one native invocation.
 * @evidence contracts/testing.md#independent-expectations Three authored source markers and an independent native run byte establish delivery and sharing.
 * @evidence contracts/testing.md#distinguishing-cases Out-of-walk source outputs must be served from the project generation rather than selected as separate projects.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_out_of_walk_source_outputs_share_one_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Entry plus two transformable node_modules sources all return PROBED from one native invocation. These assertions remain in test_transformttsc_out_of_walk_source_outputs_share_one_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_out_of_walk_source_outputs_share_one_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 2,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const modules = [
    path.join(project.root, "src", "mod0.ts"),
    ...externalSourceModules(project.root, 2),
  ];
  for (const file of modules) {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
    assert.match(result.code, /PROBED/);
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    1,
    "out-of-walk source siblings must reuse the project generation",
  );
}
