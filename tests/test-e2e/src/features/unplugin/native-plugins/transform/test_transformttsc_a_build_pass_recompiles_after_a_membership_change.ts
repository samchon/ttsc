import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../../../internal/unplugin/internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../../internal/unplugin/internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass recompiles when a source file enters the project.
 *
 * A created file is the one change a content comparison cannot see, because it
 * has no recorded entry to differ from. The directory-membership half of the
 * generation's snapshot answers for it, so the pass gate has to consult that
 * half rather than the input hashes alone.
 *
 * 1. Run a pass and assert one compile.
 * 2. Create a new source in `src`.
 * 3. Open a pass, deliver a module, and assert the project recompiled.
 *
 * @evidence contracts/testing.md#behavioral-verification After a complete pass creates one generation, appeared.ts enters src; a new pass delivers an existing module and must return transformed output with two native invocations, exposing a pass gate that compares only previously recorded content.
 * @evidence contracts/testing.md#independent-expectations A new admitted TypeScript source changes Program membership independently of old input hashes. The native sidecar run log must gain exactly one byte, while result presence confirms delivery completed; this count oracle does not inspect output for the new file.
 * @evidence contracts/testing.md#distinguishing-cases The initial populated source set is the reuse baseline; an absent source becoming present is the owned positive invalidation. Source removal/kind swap and ignored-output-directory creation remain separate complementary entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_recompiles_after_a_membership_change in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_recompiles_after_a_membership_change; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_membership_change(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    fs.writeFileSync(
      path.join(session.root, "src", "appeared.ts"),
      "export const appeared = 1;\n",
      "utf8",
    );
    session.pass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.compiles(),
      2,
      "a file entering the project must replace the generation",
    );
  } finally {
    session.close();
  }
}
