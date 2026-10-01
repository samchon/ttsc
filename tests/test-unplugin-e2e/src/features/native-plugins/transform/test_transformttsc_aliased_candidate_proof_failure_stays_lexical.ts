import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A native sidecar reports successful and failed proofs under different spellings of one candidate; transformTtsc must reject after two attempts naming graph/proof-missing, candidate-alias and producer content-unavailable, with exactly two log bytes.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately emits contradictory per-spelling proof states. Literal diagnostic components and independent capture count require lexical failure preservation rather than calculating the adapter's realpath merge; this synthetic graph does not establish native resolver reporting.
 * @evidence contracts/testing.md#distinguishing-cases One physical candidate has a proved spelling and failed alias spelling in the same envelope. The failure must not be swallowed by physical identity merging, and bounded retry must terminate.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_aliased_candidate_proof_failure_stays_lexical in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject with lexicalCandidateProofFailureAlias and a shared counting-sidecar artifact uses two required captures for the bounded failure. The linked candidate is unique case input, not a new producer build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root/log and candidate-alias target isolate the contradictory proof. One local cache owns both attempts and no earlier warm publication can bypass them. This entry lacks an explicit reset, so cache resources and temporary roots end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_aliased_candidate_proof_failure_stays_lexical; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
