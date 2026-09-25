import assert from "node:assert/strict";

import { runHoldingLock } from "../../../../../packages/ttsc/lib/internal/runHoldingLock.js";

/**
 * Verifies a build lock's release never replaces the outcome of the work the
 * lock protected.
 *
 * Both build locks released in a `finally` block, so a release that threw
 * replaced the work's outcome: a plugin build that had published its binary
 * failed, and a build that had failed reported the release's error instead of
 * its own (samchon/ttsc#1510). The work's outcome now stands, and a release
 * that still fails is handed to the caller's report.
 *
 * 1. Run work that returns a value under a release that throws: the value is
 *    returned, and the release's error is reported once.
 * 2. Run work that throws under a release that throws: the work's own error is
 *    thrown, and the release's error is reported once.
 * 3. Run work under a release that succeeds: nothing is reported, and the release
 *    ran after the work.
 */
export const test_buildlock_release_never_replaces_the_outcome_it_protected =
  () => {
    const releaseFailure = new Error("EPERM: rename current");
    const failingRelease = (): void => {
      throw releaseFailure;
    };

    // 1. A successful build keeps its result.
    const reported: unknown[] = [];
    assert.equal(
      runHoldingLock(
        () => "plugin.exe",
        failingRelease,
        (error) => reported.push(error),
      ),
      "plugin.exe",
    );
    assert.deepEqual(reported, [releaseFailure]);

    // 2. A failed build keeps its own error.
    const buildFailure = new Error('"go build" failed');
    reported.length = 0;
    assert.throws(
      () =>
        runHoldingLock(
          () => {
            throw buildFailure;
          },
          failingRelease,
          (error) => reported.push(error),
        ),
      (error: unknown) => error === buildFailure,
    );
    assert.deepEqual(reported, [releaseFailure]);

    // 3. An ordinary release.
    const order: string[] = [];
    assert.equal(
      runHoldingLock(
        () => {
          order.push("work");
          return 1;
        },
        () => order.push("release"),
        () => order.push("reported"),
      ),
      1,
    );
    assert.deepEqual(order, ["work", "release"]);
  };
