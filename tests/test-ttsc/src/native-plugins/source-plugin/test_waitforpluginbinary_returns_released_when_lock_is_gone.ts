import { TestProject } from "@ttsc/testing";

import { assert, path, waitForPluginBinary } from "../../internal/source-build";

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
