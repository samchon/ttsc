import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

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
