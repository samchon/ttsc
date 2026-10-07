import { TestProject } from "../../../../utils/src/TestProject";
import {
  acquirePluginBuildLock,
  assert,
  inspectPluginBuildLock,
  path,
  releasePluginBuildLock,
  waitForPluginBinary,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Acquires a real v3 lease with acquirePluginBuildLock, calls waitForPluginBinary with timeoutMs 0 and expects a throw matching the timed-out message, then calls inspectPluginBuildLock and asserts the state is still "active" with the lease's protocol and generation as its fence.
 * @evidence contracts/testing.md#independent-expectations The expectations come from the lock contract: an owner that is this live process cannot be retired by elapsed time, so the wait must throw rather than return released or abandoned; the error format (a finite `Nms`/`Ns`/`Nm Ns` duration naming the label and plugin) and the generation returned by acquirePluginBuildLock are authored, not computed by the wait loop.
 * @evidence contracts/testing.md#distinguishing-cases Covers only the live-owner timeout: the thrown error distinguishes it from released/published/abandoned returns, and the post-throw inspection distinguishes a loop that quietly retired or replaced the generation. Released and published outcomes are owned by the sibling waitForPluginBinary tests.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/source-plugin; it calls the lock acquire, wait, inspect and release functions over a TestProject.tmpdir directory and releases the lease in a finally block. It installs no consumer, builds no native artifact and starts no host.
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
