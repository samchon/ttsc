import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { spawnSyncWithLowDescriptors } from "../../../../../../packages/ttsc/lib/internal/spawnSyncWithLowDescriptors.js";

/**
 * Verifies subprocess resilience: the low-descriptor broker preserves spawn
 * semantics.
 *
 * The POSIX EBADF recovery path must never interpret argv through a shell or
 * change the observable result while it redirects output through scarce file
 * descriptors.
 *
 * 1. Preserve literal argv, cwd, environment, stdout and stderr.
 * 2. Preserve nonzero, missing-command, signal and timeout results.
 * 3. Observe no broker result files remain after all parent consumptions.
 *
 * @evidence contracts/testing.md#behavioral-verification The low-descriptor broker preserves literal argv, cwd, env, both streams and nonzero/missing/signal/timeout results; final directory population detects report files left after all outcomes.
 * @evidence contracts/testing.md#independent-expectations Authored argument and output sentinels plus OS child exit and signal results define spawn semantics independently of the broker transport.
 * @evidence contracts/testing.md#distinguishing-cases 1. Preserve literal argv, cwd, environment, stdout and stderr. 2. Preserve nonzero, missing-command, signal and timeout results. 3. Remove every broker result file after the parent consumes it.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls the built low-descriptor broker, whose actual generated Node child launches the target and serializes its native result for the parent. This observes the real broker protocol, not merely an independent Node language oracle or the EBADF admission branch.
 * @evidence contracts/e2e.md#necessary-boundary Actual broker opening of capture descriptors, target launch, result-file serialization and parent reconstruction/removal must preserve native process outcomes. Direct result decoding units cannot prove this real product-process protocol; actual kernel descriptor exhaustion is not induced.
 * @evidence contracts/e2e.md#shared-execution Three Windows or five POSIX logical broker calls share one Node producer/root and reusable capture filenames. Each requires its own actual broker/target attempt; a missing command attempt is not a successful target start and counts require actual trace. No consumer installation or retained broker session is inferred.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Caller owns the physical mkdtemp root and explicitly removes it after serial outcomes. Broker truncates each capture, joins its direct synchronous target then writes the report; parent consumes/removes the report before the next call. No target descendants are authored, arbitrary descendant join is not certified, and cleanup failures remain aggregate outcomes.
 * @evidence contracts/e2e.md#preserved-coverage Original literal argv/cwd/env/stdout/stderr, exit23, missing ENOENT/null, POSIX SIGTERM/null and timeout50/SIGKILL/ETIMEDOUT/null remain. Final exact stderr/stdout directory population observes all leftover reports at the end, not immediate removal after every outcome. Independent outcome failures are collected without hiding later rows; Windows original signal exclusions remain unexecuted, not PASS. Runtime/selection/survival unverified, donor retained.
 */
export const test_spawn_sync_resilient_broker_preserves_process_contract =
  (): void => {
    const root = TestProject.physicalPath(
      fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-spawn-broker-")),
    );
    const failures: Error[] = [];
    try {
      const stdout = path.join(root, "stdout");
      const stderr = path.join(root, "stderr");
      const marker = 'literal $() `" ; & | argument';
      try {
        const success = spawnSyncWithLowDescriptors(
          process.execPath,
          [
            "-e",
            [
              "process.stdout.write(JSON.stringify({",
              "  arg: process.argv[1],",
              "  cwd: process.cwd(),",
              "  value: process.env.TTSC_BROKER_VALUE,",
              "}));",
              'process.stderr.write("diagnostic");',
            ].join("\n"),
            marker,
          ],
          {
            cwd: root,
            env: { ...process.env, TTSC_BROKER_VALUE: "preserved" },
            timeout: 30_000,
          },
          { stderr, stdout },
        );
        assert.equal(success.error, undefined);
        assert.equal(success.signal, null);
        assert.equal(success.status, 0);
        assert.deepEqual(JSON.parse(fs.readFileSync(stdout, "utf8")), {
          arg: marker,
          cwd: root,
          value: "preserved",
        });
        assert.equal(fs.readFileSync(stderr, "utf8"), "diagnostic");
      } catch (error) {
        failures.push(new Error("Broker success outcome", { cause: error }));
      }

      try {
        const nonzero = spawnSyncWithLowDescriptors(
          process.execPath,
          ["-e", "process.exit(23)"],
          { cwd: root, env: process.env, timeout: 30_000 },
          { stderr, stdout },
        );
        assert.equal(nonzero.error, undefined);
        assert.equal(nonzero.signal, null);
        assert.equal(nonzero.status, 23);
      } catch (error) {
        failures.push(new Error("Broker nonzero outcome", { cause: error }));
      }

      try {
        const missing = spawnSyncWithLowDescriptors(
          path.join(root, "missing-command"),
          [],
          { cwd: root, env: process.env, timeout: 30_000 },
          { stderr, stdout },
        );
        assert.equal(missing.status, null);
        assert.equal(
          (missing.error as NodeJS.ErrnoException | undefined)?.code,
          "ENOENT",
        );
      } catch (error) {
        failures.push(new Error("Broker missing outcome", { cause: error }));
      }

      if (process.platform !== "win32") {
        try {
          const signaled = spawnSyncWithLowDescriptors(
            process.execPath,
            ["-e", 'process.kill(process.pid, "SIGTERM")'],
            { cwd: root, env: process.env, timeout: 30_000 },
            { stderr, stdout },
          );
          assert.equal(signaled.error, undefined);
          assert.equal(signaled.signal, "SIGTERM");
          assert.equal(signaled.status, null);
        } catch (error) {
          failures.push(new Error("Broker signal outcome", { cause: error }));
        }

        try {
          const timedOut = spawnSyncWithLowDescriptors(
            process.execPath,
            ["-e", "setInterval(() => undefined, 10_000)"],
            {
              cwd: root,
              env: process.env,
              killSignal: "SIGKILL",
              timeout: 50,
            },
            { stderr, stdout },
          );
          assert.equal(
            (timedOut.error as NodeJS.ErrnoException | undefined)?.code,
            "ETIMEDOUT",
          );
          assert.equal(timedOut.signal, "SIGKILL");
          assert.equal(timedOut.status, null);
        } catch (error) {
          failures.push(new Error("Broker timeout outcome", { cause: error }));
        }
      }
      try {
        assert.deepEqual(
          fs.readdirSync(root).sort(),
          ["stderr", "stdout"],
          "the broker result file must be removed after every outcome",
        );
      } catch (error) {
        failures.push(new Error("Broker final report population", { cause: error }));
      }
    } finally {
      try {
        fs.rmSync(root, { force: true, recursive: true });
      } catch (error) {
        failures.push(new Error("Broker owned root cleanup", { cause: error }));
      }
    }
    if (failures.length) throw new AggregateError(failures, "Broker process contract outcomes");
  };
