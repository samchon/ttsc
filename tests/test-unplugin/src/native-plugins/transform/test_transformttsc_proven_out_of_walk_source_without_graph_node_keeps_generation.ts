import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/** A proved source output remains usable when a legacy graph omits its node. */
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
