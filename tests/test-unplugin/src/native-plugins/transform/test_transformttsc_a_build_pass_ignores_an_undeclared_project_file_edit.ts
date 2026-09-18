import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass keeps the generation when a project file the compile never
 * consumed changes.
 *
 * A project root is a working directory: logs, coverage reports and generated
 * artifacts are written there constantly. Only a file the generation declares
 * as an input can change an output, so re-proving against the whole walk
 * instead of the declared set would hand back the per-pass recompile this
 * change removes, for a file nothing compiled.
 *
 * This pins the declared-input filter rather than the membership digest, and it
 * held before that digest existed too: rewriting a file in place moves neither
 * the directory's stamp nor its entry list. The digest's own twin is
 * `assertAPassIgnoresAnAppearingOutputDirectory`.
 */
export async function test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit(): Promise<void> {
  const session = await startDeliveryPassSession();
  const note = path.join(session.root, "src", "build-log.txt");
  fs.writeFileSync(note, "first\n", "utf8");
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // Rewritten in place: the file already existed when the generation was
    // captured, so membership is unchanged and only its content moves.
    fs.writeFileSync(note, "second, longer than the first\n", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a project file the generation never declared as an input must not cost a compile",
    );
  } finally {
    session.close();
  }
}
