import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitHashedBundle } from "../../internal/transform-program-membership/emitHashedBundle";
import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies a host with no build boundary is not charged for emitted output
 * either.
 *
 * `@ttsc/metro`, the Turbopack loader, and a watching Vite dev server never
 * call `beginTtscTransformBuild`, so their deliveries go through the live
 * mutation tracker instead of the pass gate (samchon/ttsc#1307). The tracker
 * has to answer the same question the membership digest does: a content-hashed
 * bundle fires a rename per rebuild, and treating that as membership kept the
 * whole cost on exactly the hosts the narrow path exists for.
 *
 * 1. Deliver persistently until the generation settles.
 * 2. Emit four more content-hashed bundles and assert no further compile.
 * 3. Add a source to the program and assert the next delivery recompiles.
 */
export async function test_transformttsc_a_persistent_host_ignores_emitted_output(): Promise<void> {
  const session = await startMembershipSession();
  try {
    await session.deliver();
    assert.equal(session.compiles(), 1);
    await session.deliver();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    // The output directory appears. A live tracker has to treat a new
    // directory as membership, because it cannot know what will be put in it
    // and it is not watching it yet, so this one costs a compile.
    emitHashedBundle(session.root, "lib", 1);
    await session.deliver();
    const settled = session.compiles();

    // What must cost nothing is every rebuild after it, which is where the
    // defect lived: content-hashed filenames change the directory's membership
    // on every build, and the tracker used to report each one.
    for (let build = 2; build <= 5; build += 1) {
      emitHashedBundle(session.root, "lib", build);
      await session.deliver();
    }
    assert.equal(
      session.compiles(),
      settled,
      "a persistent host must not recompile per rebuild for output it cannot admit",
    );

    // The same host must still see a real one.
    fs.writeFileSync(
      path.join(session.root, "src", "late.ts"),
      "export const late: number = 1;",
      "utf8",
    );
    await session.deliver();
    assert.equal(
      session.compiles(),
      settled + 1,
      "a persistent host must still see a source entering the program",
    );
  } finally {
    session.close();
  }
}
