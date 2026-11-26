import { Worker } from "node:worker_threads";

import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { TestProject } from "../../../../utils/src/TestProject";
import {
  acquirePluginBuildLock,
  assert,
  fs,
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
 * 4. Write successive compiler package lines over a period longer than the idle
 *    limit, then publish the binary. The second wait must adopt it.
 * 5. Leave the diagnostic file in place without writing. Its earlier output cannot
 *    keep an unrelated wait alive.
 *
 * @evidence contracts/testing.md#behavioral-verification A real v3 lease remains active after refusal, and a worker writes to the ordinary stderr path while the synchronous waiter polls. A later publication comes after more than one idle window. After removing the binary, unchanged output must still time out.
 * @evidence contracts/testing.md#independent-expectations The worker uses a fixed write cadence and publishes a real file on its own schedule. The test requires the original fence to survive and verifies the error names a finite duration and the requested plugin.
 * @evidence contracts/testing.md#distinguishing-cases An immediate timeout, ongoing output followed by publication, and earlier output with no further progress exercise the same generation without conflating time elapsed with lock retirement.
 * @evidence contracts/testing.md#execution-ownership The unit owns one tracked fixture and v3 lease; its worker is joined before removing publication and terminated in finally before releasing the lease. No native compiler is needed for this timing boundary.
 */
export const test_waitforpluginbinary_times_out_on_live_owner_with_finite_duration =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-wait-");
    const lockDir = path.join(root, "entry.lock");
    const lease = acquirePluginBuildLock(lockDir);
    assert.notEqual(lease, null);
    if (lease === null) return;

    const binaryPath = path.join(root, "plugin.exe");
    const options = {
      binaryPath,
      lockDir,
      lockInfo: {
        label: "source plugin",
        pluginName: "wait-test",
        quiet: true,
      },
    };
    const timeoutMessage =
      /timed out after (\d+ms|\d+s|\d+m \d+s) waiting for source plugin "wait-test"/;
    let writer: Worker | undefined;
    try {
      assert.throws(
        () => waitForPluginBinary({ ...options, timeoutMs: 0 }),
        timeoutMessage,
      );
      const observation = inspectPluginBuildLock(lockDir);
      assert.equal(observation.state, "active");
      if (observation.state === "active")
        assert.deepEqual(observation.fence, {
          protocol: lease.protocol,
          generation: lease.generation,
        });

      const outputDirectory = path.join(
        PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir),
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CAPTURE_DIR,
      );
      fs.mkdirSync(outputDirectory);
      const stderr = path.join(outputDirectory, "stderr");
      fs.writeFileSync(stderr, "");
      writer = new Worker(
        `
          const { appendFileSync, writeFileSync } = require("node:fs");
          const { parentPort, workerData } = require("node:worker_threads");
          parentPort.once("message", () => {
            let packages = 0;
            const poll = setInterval(() => {
              appendFileSync(workerData.stderr, "example.com/package-" + packages + "\\n");
              if (++packages === 5) {
                clearInterval(poll);
                writeFileSync(workerData.binaryPath, "binary");
              }
            }, 400);
          });
          parentPort.postMessage("ready");
        `,
        { eval: true, execArgv: [], workerData: { binaryPath, stderr } },
      );
      const completed = new Promise<number>((resolve, reject) => {
        writer!.once("exit", resolve);
        writer!.once("error", reject);
      });
      void completed.catch(() => undefined);
      await new Promise<void>((resolve, reject) => {
        writer!.once("message", resolve);
        writer!.once("error", reject);
      });
      writer.postMessage(null);
      assert.deepEqual(waitForPluginBinary({ ...options, timeoutMs: 1_200 }), {
        outcome: "published",
      });
      assert.equal(await completed, 0);
      fs.unlinkSync(binaryPath);
      assert.throws(
        () => waitForPluginBinary({ ...options, timeoutMs: 100 }),
        timeoutMessage,
      );
    } finally {
      await writer?.terminate();
      releasePluginBuildLock(lockDir, lease);
    }
  };
