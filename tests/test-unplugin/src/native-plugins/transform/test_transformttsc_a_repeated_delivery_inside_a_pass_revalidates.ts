import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a module delivered twice inside one pass revalidates on its second
 * delivery.
 *
 * The constant-time shortcut is a statement about a module's first delivery in
 * a pass. A bundler asking again is the one signal the pass itself provides
 * that something may have moved, so the retained generation must not answer it
 * from the pass gate.
 *
 * 1. Open a pass and deliver a module.
 * 2. Change the plugin descriptor.
 * 3. Deliver the same module again and assert it recompiles.
 */
export async function test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    const first = session.modules[0]!;
    session.pass();
    assert.ok(await session.deliver(first));
    assert.equal(session.compiles(), 1);

    fs.appendFileSync(
      path.join(session.root, "plugin.cjs"),
      "\n// changed inside the pass\n",
      "utf8",
    );
    assert.ok(await session.deliver(first));
    assert.equal(
      session.compiles(),
      2,
      "a module delivered twice in one pass must validate on its second delivery",
    );
  } finally {
    session.close();
  }
}
