import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { DependencyBuildAdmission } from "../../../../../packages/ttsc/src/launcher/internal/runtime/DependencyBuildAdmission";
import { acquireDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/acquireDependencyBuildLock";
import { inspectDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/inspectDependencyBuildLock";
import { releaseDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/releaseDependencyBuildLock";

/**
 * Verifies a contender's expired deadline never retires a live dependency-build
 * owner.
 *
 * A contender's deadline cannot authorize retiring a demonstrably live owner.
 * The actual source operations acquire a lease for this still-running process,
 * then expire both passive observation and full builder admission against it.
 *
 * 1. Acquire a real lease for this live process and inspect it as active.
 * 2. Expire passive waiting and full builder admission with one-millisecond and
 *    zero budgets and require timeout errors, an unreached builder and an
 *    unchanged lock state.
 * 3. Require negative, NaN and infinite budgets to throw RangeError, then release
 *    the lease and require the next wait to report it released.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual DependencyBuildAdmission.wait and run throw for a live held generation; inspection afterward retains its exact generation and no build callback executes. Normal release then produces the distinct released observation.
 * @evidence contracts/testing.md#independent-expectations Ownership is supplied by a successfully acquired lease of this live test process, independently of the contender's elapsed budget. A deadline restricts waiting rather than proving death; the acquired generation must remain unchanged until its owner releases it.
 * @evidence contracts/testing.md#distinguishing-cases Passive wait and full acquisition both expire with a positive short budget; zero-budget acquisition cannot invoke its builder; negative and nonfinite budgets reject. Explicit normal release changes the observation to released. Genuine dead-owner reclamation and child-process fencing remain in dependency-cache E2E cases.
 * @evidence contracts/testing.md#execution-ownership This named source-unit entry directly invokes authored admission and lease operations over an isolated temporary filesystem. It builds no artifact, installs no consumer and starts no product host; its current PID is already alive rather than a fabricated liveness stub.
 */
export function test_dependency_build_admission_preserves_live_ownership_when_the_contender_expires(): void {
  const root = TestProject.tmpdir("dependency-admission-live-");
  const cacheDir = path.join(root, "cache");
  const metaPath = path.join(root, "cache.json");
  const lockDir = path.join(root, "lock");
  const lease = acquireDependencyBuildLock(lockDir);
  assert.notEqual(lease, null);
  const held = inspectDependencyBuildLock(lockDir, Date.now());
  assert.equal(held.state, "active");
  let builds = 0;
  try {
    assert.throws(
      () => DependencyBuildAdmission.wait(cacheDir, metaPath, lockDir, 1),
      /dependency build admission timed out.*holding generation was not retired/,
    );
    assert.deepEqual(inspectDependencyBuildLock(lockDir, Date.now()), held);
    assert.throws(
      () => DependencyBuildAdmission.run(cacheDir, metaPath, lockDir, () => {
        ++builds;
        throw new Error("a contender must not reach its builder");
      }, 1),
      /dependency build admission timed out.*holding generation was not retired/,
    );
    assert.equal(builds, 0);
    assert.deepEqual(inspectDependencyBuildLock(lockDir, Date.now()), held);
    assert.throws(
      () => DependencyBuildAdmission.run(cacheDir, metaPath, lockDir, () => {
        ++builds;
        throw new Error("a zero-budget contender must not build");
      }, 0),
      /dependency build admission timed out/,
    );
    assert.equal(builds, 0);
    for (const budget of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => DependencyBuildAdmission.wait(cacheDir, metaPath, lockDir, budget),
        RangeError,
      );
      assert.throws(
        () => DependencyBuildAdmission.run(cacheDir, metaPath, lockDir, () => {
          throw new Error("an invalid-budget contender must not build");
        }, budget),
        RangeError,
      );
    }
    assert.deepEqual(inspectDependencyBuildLock(lockDir, Date.now()), held);
  } finally {
    assert.equal(releaseDependencyBuildLock(lockDir, lease!), true);
  }
  assert.deepEqual(DependencyBuildAdmission.wait(cacheDir, metaPath, lockDir, 1), {
    outcome: "released",
  });
}
