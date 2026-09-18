import assert from "node:assert/strict";
import fs from "node:fs";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass recompiles when a type-only input changes, although the
 * bundler never delivers that file.
 *
 * This is the input class the reference graph exists for. A bundler erases a
 * type-only edge from its module graph, so only the generation's recorded
 * snapshot can notice the edit, and a retained generation that missed it would
 * serve code compiled against the old type.
 *
 * 1. Run a pass and assert one compile.
 * 2. Edit the module reached only through a type-only edge.
 * 3. Open a pass, deliver another module, and assert the project recompiled.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // A sibling reached only through the fixture's graph edges, never through
    // an import the bundler could see, and never delivered in this pass.
    const typeOnly = session.modules[session.modules.length - 1]!;
    fs.appendFileSync(typeOnly, "\nexport const shifted = true;\n", "utf8");

    session.pass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.compiles(),
      2,
      "an edited type-only input must replace the generation before the next pass delivers anything",
    );
  } finally {
    session.close();
  }
}
