import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass keeps the generation when a bundler creates its output
 * directory inside the project.
 *
 * The membership proof has to honour the same ignore rules the walk does. A
 * directory's own stamp moves whenever any entry is added or removed, so
 * comparing raw directory metadata meant a bundler emitting into `dist/`, or
 * merely creating it, voided a generation no compiler input had touched. That
 * is what every host that writes its bundle into the project does on its first
 * build. The negative twin is
 * `test_transformttsc_a_build_pass_recompiles_after_a_membership_change`.
 *
 * 1. Run a pass and assert one compile.
 * 2. Create `dist`, `out`, `coverage`, and `.cache` holding emitted JavaScript.
 * 3. Run another pass and assert it reuses the generation.
 */
export async function test_transformttsc_a_build_pass_ignores_an_appearing_output_directory(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    for (const ignored of ["dist", "out", "coverage", ".cache"]) {
      const directory = path.join(session.root, ignored);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "bundle.js"), "// emitted", "utf8");
    }
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a bundler creating its own output directory must not void the generation",
    );
  } finally {
    session.close();
  }
}
