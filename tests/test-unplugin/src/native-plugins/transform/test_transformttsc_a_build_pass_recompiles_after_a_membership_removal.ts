import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies a pass recompiles when a source leaves the project or changes kind,
 * and not when a non-program file leaves.
 *
 * A removal has no recorded hash to differ from, and a kind swap keeps the
 * name, so the membership digest is the only thing that answers for either.
 * What the digest answers for is program membership: a source leaving is a
 * membership change, while a stray `.txt` leaving is not, any more than editing
 * one is (samchon/ttsc#1307).
 *
 * 1. Remove a planted text file and assert the next pass reuses the generation.
 * 2. Add, remove, and re-add a source, and assert each change recompiles.
 * 3. Replace a source with a directory of the same name and assert it recompiles.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_membership_removal(): Promise<void> {
  const session = await startDeliveryPassSession();
  const note = path.join(session.root, "src", "notes.txt");
  fs.writeFileSync(note, "planted before the generation\n", "utf8");
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // A file the program could never contain, and never declared as an input.
    fs.rmSync(note);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a file that could not enter the program must not cost a compile when it leaves",
    );

    const source = path.join(session.root, "src", "extra.ts");
    fs.writeFileSync(source, "export const extra: number = 1;", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "a source entering the project must replace the generation",
    );

    fs.rmSync(source);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      3,
      "a source leaving the project must replace the generation",
    );

    // Same name, different kind, with both kinds carrying program inputs: a
    // source file becomes a directory holding one. The content comparison
    // cannot see this, since the name's hash simply stops existing and a new
    // one appears elsewhere, so the digest is the only thing that answers.
    fs.writeFileSync(source, "export const extra: number = 2;", "utf8");
    await deliverPass(session);
    assert.equal(session.compiles(), 4, "the source returning is a change too");

    fs.rmSync(source);
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, "inner.ts"),
      "export const inner: number = 1;",
      "utf8",
    );
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      5,
      "an entry changing kind must replace the generation",
    );
  } finally {
    session.close();
  }
}
