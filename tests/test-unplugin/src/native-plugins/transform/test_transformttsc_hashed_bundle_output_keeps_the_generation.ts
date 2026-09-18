import assert from "node:assert/strict";

import { emitHashedBundle } from "../../internal/transform-program-membership/emitHashedBundle";
import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies content-hashed bundle output costs no compile, in a directory no
 * configuration names.
 *
 * The sharpest form of samchon/ttsc#1307. Rewriting one output file in place is
 * already free, because content is compared over the generation's declared
 * inputs alone. Content-hashed filenames are not: every rebuild removes a name
 * and adds another, which is a directory membership change, and the digest used
 * to record every entry regardless of whether it could ever enter the program.
 * That made a bundler's own output invalidate the generation that produced it,
 * once per rebuild, for the whole life of the session.
 *
 * `lib` is deliberately not the project's `outDir` and not one of the three
 * names the walk still refuses, so nothing but the input-extension rule can
 * make this pass: the project admits no JavaScript, so a `.js` bundle is not a
 * membership change wherever it lands.
 */
export async function test_transformttsc_hashed_bundle_output_keeps_the_generation(): Promise<void> {
  const session = await startMembershipSession();
  try {
    for (let build = 1; build <= 4; build += 1) {
      emitHashedBundle(session.root, "lib", build);
      await session.pass();
    }
    assert.equal(
      session.compiles(),
      1,
      "content-hashed output must not cost a compile per rebuild",
    );
  } finally {
    session.close();
  }
}
