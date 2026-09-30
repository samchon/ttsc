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
 * 1. Call the wait loop with a lock path and binary path that both do not exist.
 * 2. Assert it returns `{ outcome: "released" }` without consuming the generous
 *    timeout.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual wait loop with absent binary and lock paths and observes released.
 * @evidence contracts/testing.md#independent-expectations The authored absence of both fixture paths means free but unpublished; literal released is independent of the loop implementation.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts the published-file and live-owner zero-budget twins; a generous wait budget must not cause polling on an absent lock.
 * @evidence contracts/testing.md#execution-ownership test_waitforpluginbinary_returns_released_when_lock_is_gone is discovered once under src/unit/source-plugin and directly invokes the authored lock/cache operation over test-owned paths. This case installs no consumer, builds no artifact and starts no product host; the temporary-directory owner and its explicit lease finally blocks release its state.
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
