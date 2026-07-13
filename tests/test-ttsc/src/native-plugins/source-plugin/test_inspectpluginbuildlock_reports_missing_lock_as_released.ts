import { TestProject } from "@ttsc/testing";

import {
  assert,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock reports a missing lock directory as released.
 *
 * Pins the issue #421 regression in
 * `buildSourcePlugin.ts::inspectPluginBuildLock`. A holder's `finally` removes
 * the lock the moment its build publishes or throws, so a waiter routinely
 * observes the directory vanishing between two polls. The old code encoded the
 * failed `statSync` as an Infinity age, classified the released lock as an
 * infinitely old abandoned legacy lock, and printed `Infinitym NaNs old`.
 * "Missing" must be the first-class `released` state, never an age.
 *
 * 1. Point inspection at a lock path that does not exist.
 * 2. Assert the observation is exactly `{ state: "released" }` — not abandoned,
 *    and carrying no fabricated owner or age.
 */
export const test_inspectpluginbuildlock_reports_missing_lock_as_released =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");

    const observation = inspectPluginBuildLock(lockDir, Date.now());

    assert.deepEqual(observation, { state: "released" });
  };
