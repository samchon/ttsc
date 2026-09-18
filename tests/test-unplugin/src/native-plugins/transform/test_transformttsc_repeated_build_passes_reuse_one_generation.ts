import assert from "node:assert/strict";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

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
