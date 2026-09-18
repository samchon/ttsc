import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies a proven out-of-walk source output stays usable when a legacy graph
 * omits its node.
 *
 * Older hosts do not list every emitted source as a graph node. The output's
 * own compiler proof is still valid evidence, so the generation must keep
 * serving it instead of treating the missing node as an unproven input.
 *
 * 1. Create a project that emits an external source output without a graph node
 *    for it.
 * 2. Deliver the entry and the external source.
 * 3. Assert both are served from one generation.
 */
export async function test_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 1,
    fileCount: 2,
    graphFanout: 1,
    omitExternalSourceGraphNode: true,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  for (const file of [
    path.join(project.root, "src", "mod0.ts"),
    ...externalSourceModules(project.root, 1),
  ]) {
    assert.ok(
      await transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
      ),
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    1,
    "the source output's compiler proof must survive an omitted graph node",
  );
}
