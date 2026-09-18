import assert from "node:assert/strict";
import fs from "node:fs";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

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
