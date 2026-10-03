import { TestProject } from "../../../../utils/src/TestProject";

import { assert, path, waitForPluginBinary } from "../../internal/source-build-unit";

/**
 * Verifies waitForPluginBinary returns `released` when the lock is gone and no
 * binary exists.
 *
 * Pins the wait loop's dispatch for the issue #421 race: a waiter that lost the
 * `mkdir` race inspects a lock the holder has since removed without publishing
 * (its build failed). The loop must hand the free key back as `released`
 * immediately — not report abandonment, not fabricate an Infinity age, and not
 * burn the wait budget polling a lock that no longer exists.
 *
 * 1. Call the wait loop with a lock path and binary path that both do not exist
 *    under a fresh temporary directory, with a 600-second timeout.
 * 2. Assert it returns exactly `{ outcome: "released" }`; the call returning at
 *    all (rather than polling for the 600-second budget) is part of the check.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls waitForPluginBinary with a nonexistent binary path and nonexistent lock directory and asserts the returned outcome object with deepEqual.
 * @evidence contracts/testing.md#independent-expectations The fixture is authored so that neither the binary nor the lock exists, which by the lock contract means a free key with nothing published; the literal `{ outcome: "released" }` follows from that and is not computed by the loop.
 * @evidence contracts/testing.md#distinguishing-cases Contributes only the no-lock, no-binary case; a loop that returned "published", returned "abandoned", threw a timeout, or polled until the 600-second budget would fail or hang. The published-binary case is owned by test_waitforpluginbinary_prefers_published_binary_over_released_lock and the live-owner case by test_waitforpluginbinary_times_out_on_live_owner_with_finite_duration.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/source-plugin; it calls waitForPluginBinary over a TestProject.tmpdir directory, which TestProject removes at process exit, and acquires no lock, so no lease needs releasing. It installs no consumer, builds no native artifact and starts no host.
 */
export const test_waitforpluginbinary_returns_released_when_lock_is_gone =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-wait-");

    const result = waitForPluginBinary({
      binaryPath: path.join(root, "entry", "plugin.exe"),
      lockDir: path.join(root, "entry.lock"),
      lockInfo: {
        label: "source plugin",
        pluginName: "wait-test",
        quiet: true,
      },
      timeoutMs: 600_000,
    });

    assert.deepEqual(result, { outcome: "released" });
  };
