import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies inspectPluginBuildLock reports a missing lock directory as released.
 *
 * Pins the issue #421 regression in
 * `inspectPluginBuildLock.ts::inspectPluginBuildLock`. A holder's `finally`
 * removes the lock the moment its build publishes or throws, so a waiter
 * routinely observes the directory vanishing between two polls. The old code
 * encoded the failed `statSync` as an Infinity age, classified the released
 * lock as an infinitely old abandoned legacy lock, and printed `Infinitym NaNs
 * old`. "Missing" must be the first-class `released` state, never an age.
 *
 * 1. Point inspection at a lock path that does not exist.
 * 2. Assert the observation is exactly `{ state: "released" }` — not abandoned,
 *    and carrying no fabricated owner or age.
 *
 * @evidence contracts/testing.md#behavioral-verification Inspects an absent lock directory and returns only released.
 * @evidence contracts/testing.md#independent-expectations Authored absence means no holder; the literal one-field released object rejects fabricated owner, abandonment or infinite age.
 * @evidence contracts/testing.md#distinguishing-cases Only the absent-directory case is run; the existing-directory states (fresh, old, corrupt, live and foreign-host owners) are other tests' cases.
 * @evidence contracts/testing.md#execution-ownership A unit test calling inspectPluginBuildLock directly on a lock path that does not exist in a private temp directory; it acquires no lease and starts no process, build or host.
 */
export const test_inspectpluginbuildlock_reports_missing_lock_as_released =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");

    const observation = inspectPluginBuildLock(lockDir);

    assert.deepEqual(observation, { state: "released" });
  };
