import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/** An aliased candidate proof failure remains bound to its exact spelling. */
export async function test_transformttsc_aliased_candidate_proof_failure_stays_lexical(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    lexicalCandidateProofFailureAlias: true,
    fileCount: 1,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  const main = projectModules(project.root)[0]!;
  await assert.rejects(
    () =>
      transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        resolveOptions(),
        undefined,
        cache,
      ),
    /after 2 attempts[\s\S]*graph\/proof-missing[\s\S]*candidate-alias[\s\S]*producer: "content-unavailable"/,
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "an aliased candidate failure must stay on its own spelling and terminate after two attempts",
  );
}
