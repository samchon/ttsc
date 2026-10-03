import assert from "node:assert/strict";

import { deliverPass } from "../../../../internal/unplugin/internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../../internal/unplugin/internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies repeated passes over an unchanged project reuse one generation
 * (samchon/ttsc#1300).
 *
 * A pass boundary states that each module is requested at most once inside it;
 * it says nothing about whether the compiled program is still correct, which
 * the generation's recorded snapshot answers. Destroying the generation at
 * every boundary cost a whole-project transform on every rebuild of every
 * watching host.
 *
 * 1. Run a cold pass and assert one compile.
 * 2. Run two more passes without changing an input.
 * 3. Assert the project still compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification Cold pass and two later unchanged passes finish with one compile.
 * @evidence contracts/testing.md#independent-expectations Fixture byte counter independently detects unnecessary producer executions.
 * @evidence contracts/testing.md#distinguishing-cases Three explicit pass boundaries without changed compiler input.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_repeated_build_passes_reuse_one_generation is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for three explicit pass boundaries without changed compiler input. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. Session.close runs in finally and resets its cache observers; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Cold pass and two later unchanged passes finish with one compile. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_repeated_build_passes_reuse_one_generation(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1, "the cold pass compiles once");
    await deliverPass(session);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a pass that changed no compiler input must reuse the proven generation",
    );
  } finally {
    session.close();
  }
}
