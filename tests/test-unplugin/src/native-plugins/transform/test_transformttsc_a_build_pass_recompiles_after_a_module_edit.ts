import assert from "node:assert/strict";
import fs from "node:fs";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass that edits a delivered module's own source recompiles exactly
 * once, and that the pass after it reuses the replacement.
 *
 * The negative twin of the reuse case: retention must not outlive the state it
 * was proven against, and the module whose bytes changed is the one input the
 * bundler itself supplies, so it is caught by the source comparison before any
 * proof runs.
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
