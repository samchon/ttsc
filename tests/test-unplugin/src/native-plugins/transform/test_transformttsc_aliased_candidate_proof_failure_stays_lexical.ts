import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies an aliased candidate's proof failure stays bound to its exact
 * spelling.
 *
 * Two spellings of one candidate can reach the host, one with a proof and one
 * whose read failed. Folding them into one identity would let the proof hide
 * the failure, so the failure must stay on its own spelling and end the attempt
 * after the bounded retry.
 *
 * 1. Create a project whose graph reports a proof and a failure under separate
 *    spellings of one candidate.
 * 2. Transform its module and assert it rejects after two attempts, naming the
 *    aliased spelling and the producer's failure.
 * 3. Assert exactly two compiles ran.
 */
export async function test_transformttsc_aliased_candidate_proof_failure_stays_lexical(): Promise<void> {
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
