import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../../internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../internal/transform-delivery-epoch/startDeliveryPassSession";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Passes require invocation counts 1,1,2,3,4,5 while a text file leaves, a TypeScript source enters, leaves, returns, and becomes a directory holding inner.ts. The negative text removal prevents arbitrary directory stamp changes from passing as membership changes.
 * @evidence contracts/testing.md#independent-expectations Program membership includes admitted sources and their kind, while notes.txt cannot enter the fixture Program. Independent sidecar log bytes and literal count sequence distinguish each transition without reproducing the digest implementation.
 * @evidence contracts/testing.md#distinguishing-cases Non-program removal is the no-op control; source creation, deletion and reappearance each invalidate, and a same-name file-to-directory swap carries a new nested source. Source content edit is owned by the module-edit entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_build_pass_recompiles_after_a_membership_removal in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startDeliveryPassSession uses createCacheProject, which materializes one shared Go counting sidecar source and reuses the suite native build cache. One fresh project, options and cache serve every pass in this entry; only changed Program inputs require another native invocation, not another installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session owns unique project and run-log directories; successive passes intentionally share the cache and mutate only this project. The sidecar log starts absent and counts this scenario alone. finally calls session.close to reset the cache and release trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_build_pass_recompiles_after_a_membership_removal; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
