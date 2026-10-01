import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitHashedBundle } from "../../../internal/transform-program-membership/emitHashedBundle";
import { startMembershipSession } from "../../../internal/transform-program-membership/startMembershipSession";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Persistent deliveries retain one generation initially, allow the first lib directory appearance to settle, then require four content-hashed output rebuilds to leave the invocation count unchanged. A new late.ts must add exactly one invocation.
 * @evidence contracts/testing.md#independent-expectations JavaScript output is not admitted by this fixture policy, whereas late.ts is. The sidecar log records actual native captures; comparison to the settled count permits the legitimate first-directory cost without deriving expected results from cache validation.
 * @evidence contracts/testing.md#distinguishing-cases No-pass persistent ownership, initial output-directory appearance, four later hash-renamed bundles and real source creation distinguish watcher membership from pass-gate behavior. The appearing-output-directory entry owns the build-pass counterpart.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_persistent_host_ignores_emitted_output in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One startMembershipSession project and cache serve every persistent delivery with the shared Go sidecar artifact. emitHashedBundle changes only the case input, without another fixture installation; captures after actual admitted source creation remain necessary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root/log isolate the output files and late source. The settled count is captured after actual directory creation rather than warming past the transition silently. finally closes the session and releases trackers; TestProject cleans directories at runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_persistent_host_ignores_emitted_output; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
