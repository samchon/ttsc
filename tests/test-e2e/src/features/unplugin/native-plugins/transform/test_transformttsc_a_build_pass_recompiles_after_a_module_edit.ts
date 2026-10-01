import assert from "node:assert/strict";
import fs from "node:fs";

import { deliverPass } from "../../../../internal/unplugin/internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../../internal/unplugin/internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass that edits a delivered module recompiles once, and the next
 * pass reuses the replacement.
 *
 * This is the negative twin of reuse: retention must not outlive the state it
 * was proven against. The edited module is the one input the bundler itself
 * supplies, so the source comparison catches it before any proof runs.
 *
 * 1. Run a pass and assert one compile.
 * 2. Edit a module and run a pass, and assert one more compile.
 * 3. Run another pass and assert it reuses the replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification Three deliverPass calls surround an append to the first module. Invocation counts must be 1,2,2, catching both stale source reuse and unnecessary recompilation of the unchanged replacement.
 * @evidence contracts/testing.md#independent-expectations The supplied source changes by a literal new export, so one replacement is required; unchanged bytes in the next pass permit reuse. Sidecar log bytes independently observe captures. The test asserts delivery through the helper but does not separately execute the added export.
 * @evidence contracts/testing.md#distinguishing-cases The edited delivered module is a direct-source invalidation, followed by a reuse control. An undelivered type-only source is owned by the adjacent type-only-input entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_recompiles_after_a_module_edit in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_recompiles_after_a_module_edit; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_module_edit(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    const edited = session.modules[0]!;
    fs.appendFileSync(edited, "\nexport const added = 1;\n", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "an edited module must replace the generation exactly once",
    );

    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "the pass after the edit must reuse the replacement",
    );
  } finally {
    session.close();
  }
}
