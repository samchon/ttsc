import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "./deliverPass";
import { startDeliveryPassSession } from "./startDeliveryPassSession";

/**
 * Asserts a pass recompiles when project membership changes.
 *
 * A created file is the one change a content comparison cannot see, because it
 * has no recorded entry to differ from. The directory-membership half of the
 * generation's snapshot is what answers for it, and the pass gate has to
 * consult that half rather than the input hashes alone.
 */
export async function assertAPassRecompilesAfterAMembershipChange(): Promise<void> {
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
