import { TestProject } from "@ttsc/testing";

import {
  acquirePluginBuildLock,
  assert,
  inspectPluginBuildLock,
  path,
  releasePluginBuildLock,
  waitForPluginBinary,
} from "../../internal/source-build";

/**
 * Verifies waitForPluginBinary times out on a live owner with a finite
 * duration.
 *
 * A live holder that never publishes must eventually hit the wait budget, but
 * elapsed time cannot authorize retirement of its still-running task. The error
 * names a finite duration while the original lease remains active.
 *
 * 1. Acquire a v3 lock owned by this process so inspection stays `active`.
 * 2. Call the wait loop with a zero timeout budget.
 * 3. Assert it throws a finite timeout without changing the held generation.
 */
export const test_waitforpluginbinary_times_out_on_live_owner_with_finite_duration =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-wait-");
    const lockDir = path.join(root, "entry.lock");
    const lease = acquirePluginBuildLock(lockDir);
    assert.notEqual(lease, null);
    if (lease === null) return;

    try {
      assert.throws(
        () =>
          waitForPluginBinary({
            binaryPath: path.join(root, "entry", "plugin.exe"),
            lockDir,
            lockInfo: {
              label: "source plugin",
              pluginName: "wait-test",
              quiet: true,
            },
            timeoutMs: 0,
          }),
        /timed out after (\d+ms|\d+s|\d+m \d+s) waiting for source plugin "wait-test"/,
      );
      const observation = inspectPluginBuildLock(lockDir);
      assert.equal(observation.state, "active");
      if (observation.state === "active")
        assert.deepEqual(observation.fence, {
          protocol: lease.protocol,
          generation: lease.generation,
        });
    } finally {
      releasePluginBuildLock(lockDir, lease);
    }
  };
