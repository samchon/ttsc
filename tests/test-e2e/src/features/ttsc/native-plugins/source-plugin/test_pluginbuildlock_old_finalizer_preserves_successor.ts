import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
  reclaimPluginBuildLock,
  sourceBuildLibraryPath,
  spawnNodeWorker,
  waitForCondition,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies an old holder's delayed finalizer cannot release its successor.
 *
 * A first child keeps generation A alive while the parent retires A and lets a
 * second child acquire B. Only after B is visibly current may A run its normal
 * `finally`; A's deterministic tombstone already exists, so its rename fails
 * without touching B.
 *
 * 1. Hold generation A in a child and reclaim it from the parent.
 * 2. Let a second child acquire B, then release A's delayed finalizer.
 * 3. Assert A reports loss, B remains current, and B later releases normally.
 *
 * @evidence contracts/testing.md#behavioral-verification After the parent retires live generation A and B acquires current, A's delayed release must return false without removing B; B must later release true and both tombstones must remain.
 * @evidence contracts/testing.md#independent-expectations Independent child lease/result files and release barriers order the parent reclamation and delayed finalizer. Literal released booleans and the captured B fence define the expected ownership outcome.
 * @evidence contracts/testing.md#distinguishing-cases Parent reclaim while A is still alive, B current before A finalizes, losing A finalizer and normal B release distinguish lease history from current ownership; legacy namespace and two stale observer races are separate cases.
 * @evidence contracts/testing.md#execution-ownership The named generic entry directly invokes built workspace reclaim/inspect and two actual Node workers invoke acquire/release against the same native path. This is not a packed consumer or Go compilation proof.
 * @evidence contracts/e2e.md#necessary-boundary An old live PID can still execute its finally after a successor owns current; native generation/tombstone fencing must prevent that real late action from releasing the successor.
 * @evidence contracts/e2e.md#shared-execution One holder script and lock root are shared by the A/B roles. Two concurrent holder lifetimes preserve the delayed-action premise; neither role installs a consumer or builds Go.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private lease/result/barrier files distinguish generations, with the owned root retained before preparation. Each holder is registered immediately; finally attempts both release barriers and collects every registered worker outcome alongside body failures. Shared helper ordinary outcomes follow actual close, but its separate close deadline remains unjoined failure, not termination or descendant proof.
 * @evidence contracts/e2e.md#preserved-coverage Original parent reclaim, status0, false/true release records, active B fence, final released classification and both tombstones remain. Signal guards and failure aggregation strengthen setup/reset; no actual selection, close, survival or preparation-cost reduction has been measured.
 */
export const test_pluginbuildlock_old_finalizer_preserves_successor =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-finalizer-");
    TestProject.retainTemporaryDirectory(root, "late-finalizer workers require actual close before input reclamation");
    const lockDir = path.join(root, "entry.lock");
    const oldLeaseFile = path.join(root, "old-lease.json");
    const oldFinalizeFile = path.join(root, "old-finalize");
    const oldResultFile = path.join(root, "old-result.json");
    const successorLeaseFile = path.join(root, "successor-lease.json");
    const successorReleaseFile = path.join(root, "successor-release");
    const successorResultFile = path.join(root, "successor-result.json");
    const workerScript = path.join(root, "holder.cjs");

    fs.writeFileSync(
      workerScript,
      [
        `const fs = require("node:fs");`,
        `const { acquirePluginBuildLock } = require(${JSON.stringify(
          sourceBuildLibraryPath("acquirePluginBuildLock"),
        )});`,
        `const { releasePluginBuildLock } = require(${JSON.stringify(
          sourceBuildLibraryPath("releasePluginBuildLock"),
        )});`,
        `const lockDir = ${JSON.stringify(lockDir)};`,
        `const leaseFile = process.env.LOCK_LEASE_FILE;`,
        `const releaseFile = process.env.LOCK_RELEASE_FILE;`,
        `const resultFile = process.env.LOCK_RESULT_FILE;`,
        `let lease = null;`,
        `const acquireDeadline = Date.now() + 120000;`,
        `while (lease === null) {`,
        `  lease = acquirePluginBuildLock(lockDir);`,
        `  if (Date.now() > acquireDeadline) throw new Error("timed out acquiring lock");`,
        `  if (lease === null) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `}`,
        `fs.writeFileSync(leaseFile, JSON.stringify(lease), "utf8");`,
        `const releaseDeadline = Date.now() + 120000;`,
        `while (!fs.existsSync(releaseFile)) {`,
        `  if (Date.now() > releaseDeadline) throw new Error("timed out waiting to release");`,
        `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `}`,
        `const released = releasePluginBuildLock(lockDir, lease);`,
        `fs.writeFileSync(resultFile, JSON.stringify({ released }), "utf8");`,
        "",
      ].join("\n"),
      "utf8",
    );

    const workers: Array<ReturnType<typeof spawnNodeWorker>> = [];
    const failures: unknown[] = [];
    try {
      const oldHolder = spawnNodeWorker({
        env: {
          LOCK_LEASE_FILE: oldLeaseFile,
          LOCK_RELEASE_FILE: oldFinalizeFile,
          LOCK_RESULT_FILE: oldResultFile,
        },
        script: workerScript,
      });
      workers.push(oldHolder);
      void oldHolder.catch(() => undefined);
      await waitForCondition(
        () => fs.existsSync(oldLeaseFile),
        "old holder acquisition",
      );
      const oldLease = JSON.parse(fs.readFileSync(oldLeaseFile, "utf8")) as {
        generation: string;
        protocol: "v3";
      };
      assert.equal(
        reclaimPluginBuildLock(lockDir, oldLease),
        true,
        "the parent should retire generation A",
      );

      const successor = spawnNodeWorker({
        env: {
          LOCK_LEASE_FILE: successorLeaseFile,
          LOCK_RELEASE_FILE: successorReleaseFile,
          LOCK_RESULT_FILE: successorResultFile,
        },
        script: workerScript,
      });
      workers.push(successor);
      void successor.catch(() => undefined);
      await waitForCondition(
        () => fs.existsSync(successorLeaseFile),
        "successor acquisition",
      );
      const successorLease = JSON.parse(
        fs.readFileSync(successorLeaseFile, "utf8"),
      ) as { generation: string; protocol: "v3"; completionNonce: string };

      fs.writeFileSync(oldFinalizeFile, "release\n", "utf8");
      await waitForCondition(
        () => fs.existsSync(oldResultFile),
        "old finalizer result",
      );
      const oldResult = await oldHolder;
      assert.equal(oldResult.signal, null, oldResult.stderr);
      assert.equal(oldResult.status, 0, oldResult.stderr);
      assert.deepEqual(JSON.parse(fs.readFileSync(oldResultFile, "utf8")), {
        released: false,
      });
      const whileSuccessorHeld = inspectPluginBuildLock(lockDir);
      assert.equal(whileSuccessorHeld.state, "active");
      assert.deepEqual(
        whileSuccessorHeld.state === "active" ? whileSuccessorHeld.fence : null,
        {
          protocol: successorLease.protocol,
          generation: successorLease.generation,
        },
      );

      fs.writeFileSync(successorReleaseFile, "release\n", "utf8");
      const successorResult = await successor;
      assert.equal(successorResult.signal, null, successorResult.stderr);
      assert.equal(successorResult.status, 0, successorResult.stderr);
      assert.deepEqual(JSON.parse(fs.readFileSync(successorResultFile, "utf8")), {
        released: true,
      });
      assert.deepEqual(inspectPluginBuildLock(lockDir), {
        state: "released",
      });
      assert.equal(
        fs.existsSync(path.join(`${lockDir}.v3`, "retired", oldLease.generation)),
        true,
      );
      assert.equal(
        fs.existsSync(
          path.join(`${lockDir}.v3`, "retired", successorLease.generation),
        ),
        true,
      );
    } catch (error) {
      failures.push(error);
    } finally {
      for (const releaseFile of [oldFinalizeFile, successorReleaseFile]) {
        try {
          fs.writeFileSync(releaseFile, "release\n", "utf8");
        } catch (error) {
          failures.push(error);
        }
      }
      for (const result of await Promise.allSettled(workers)) {
        if (result.status === "rejected" && !failures.includes(result.reason))
          failures.push(result.reason);
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(failures, "late-finalizer body or worker release failed");
  };
