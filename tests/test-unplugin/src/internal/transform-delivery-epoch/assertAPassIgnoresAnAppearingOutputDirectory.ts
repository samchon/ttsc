import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "./deliverPass";
import { startDeliveryPassSession } from "./startDeliveryPassSession";

/**
 * Asserts a pass keeps the generation when a bundler creates its output
 * directory inside the project.
 *
 * The membership proof has to honour the same ignore list the walk does. A
 * directory's own stamp moves whenever any entry is added or removed, including
 * the ones the walk exists to ignore, so comparing raw directory metadata meant
 * a bundler emitting into `dist/` — or merely creating it for the first time —
 * moved the project root's stamp and voided a generation no compiler input had
 * touched. That is not a corner case: it is what every host that writes its
 * bundle into the project does on its first build, which is precisely the build
 * before the first rebuild this whole change exists to make cheap.
 *
 * Its negative twin is `assertAPassRecompilesAfterAMembershipChange`: a file
 * the walk does consider must still replace the generation.
 */
export async function assertAPassIgnoresAnAppearingOutputDirectory(): Promise<void> {
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
