import assert from "node:assert/strict";

import { emitHashedBundle } from "../../internal/transform-program-membership/emitHashedBundle";
import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies content-hashed bundle output costs no compile, in a directory no
 * configuration names.
 *
 * Rewriting one output file in place is already free, because content is
 * compared over declared inputs alone. Content-hashed filenames are not: every
 * rebuild removes a name and adds another, which is a directory membership
 * change, and the digest used to record every entry, so a bundler's own output
 * invalidated the generation that produced it once per rebuild
 * (samchon/ttsc#1307). `lib` is neither the `outDir` nor a name the walk
 * refuses, so only the input-extension rule can make this pass: a project that
 * admits no JavaScript cannot gain a `.js` input.
 *
 * 1. Start a membership session over a project that admits no JavaScript.
 * 2. Emit a content-hashed bundle into `lib` and run a pass, four times.
 * 3. Assert the project compiled once.
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
