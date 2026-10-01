import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass keeps the generation when a project file the compile never
 * consumed changes.
 *
 * A project root is a working directory where logs, coverage reports, and
 * generated artifacts are written constantly. Only a file the generation
 * declares as an input can change an output, so re-proving against the whole
 * walk instead of the declared set would bring back the per-pass recompile for
 * a file nothing compiled. This pins the declared-input filter, not the
 * membership digest, whose twin is
 * `test_transformttsc_a_build_pass_ignores_an_appearing_output_directory`.
 *
 * 1. Plant a text file in `src` and run a pass.
 * 2. Rewrite the text file.
 * 3. Run another pass and assert it reuses the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification A text file exists before the first transform pass and is rewritten to longer content before the next pass. Both compile-count assertions require one native invocation, distinguishing irrelevant content churn from declared-input invalidation.
 * @evidence contracts/testing.md#independent-expectations The fixture graph declares source inputs, not build-log.txt. Changing only that existing text file cannot affect the transformation; independent run-log bytes and literal one-invocation expectations catch an adapter that hashes all walked files.
 * @evidence contracts/testing.md#distinguishing-cases Existing irrelevant content changes without membership creation or removal. The appearing-output-directory entry owns ignored membership churn; type-only input edit owns a declared but undelivered input change.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit(): Promise<void> {
  const session = await startDeliveryPassSession();
  const note = path.join(session.root, "src", "build-log.txt");
  fs.writeFileSync(note, "first\n", "utf8");
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // Rewritten in place: the file already existed when the generation was
    // captured, so membership is unchanged and only its content moves.
    fs.writeFileSync(note, "second, longer than the first\n", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a project file the generation never declared as an input must not cost a compile",
    );
  } finally {
    session.close();
  }
}
