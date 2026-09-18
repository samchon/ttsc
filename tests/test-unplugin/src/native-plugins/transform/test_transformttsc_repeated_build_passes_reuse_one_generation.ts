import assert from "node:assert/strict";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies samchon/ttsc#1300: repeated passes over an unchanged project reuse
 * the one generation instead of recompiling per pass.
 *
 * This is the whole defect in one measurement. A pass boundary states that each
 * module is requested at most once inside it; it says nothing about whether the
 * compiled program is still correct, which the generation's own recorded
 * snapshot answers. Destroying the generation to assert the first fact cost a
 * whole-project transform on every rebuild of every watching host.
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
