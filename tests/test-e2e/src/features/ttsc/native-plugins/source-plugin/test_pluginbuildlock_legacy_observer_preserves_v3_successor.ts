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
 * Verifies a stale legacy observer cannot retire a v3 successor.
 *
 * A legacy holder may normally remove the whole legacy lock path after another
 * process captured its fence. The successor must live in an ownership namespace
 * that this delayed legacy reclaim can never rename, even though the observer's
 * deterministic retirement destination has not previously been populated.
 *
 * 1. Observe a live legacy holder, then let it remove its lock normally.
 * 2. Hold a v3 successor in a second child process.
 * 3. Apply the stale legacy fence and assert the successor remains current.
 *
 * @evidence contracts/testing.md#behavioral-verification A stale legacy fence must fail to retire a later live v3 successor; inspection must still name the successor generation, whose own release succeeds and leaves the lock released.
 * @evidence contracts/testing.md#independent-expectations A child writes/removes a genuine legacy owner path before a second child reports its acquired v3 lease. Explicit role barriers and literal false/active/true/released outcomes define the expected namespace separation.
 * @evidence contracts/testing.md#distinguishing-cases Normal legacy disappearance precedes an unretired v3 successor, so the old fence cannot depend on an already occupied retirement destination. Same-v3 stale observers and delayed finalizers are owned by companion cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this generic async export. Real legacy/successor workers invoke built workspace lock operations and the parent applies the captured legacy fence while actual successor ownership remains active; no compiler/payload/packed installation is asserted.
 * @evidence contracts/e2e.md#necessary-boundary A deletable legacy pathname and persistent v3 namespace must remain separate across real process handoff; a single stored protocol value cannot establish that old retirement leaves live successor ownership intact.
 * @evidence contracts/e2e.md#shared-execution One script and private lock root serve sequential legacy/successor roles. These two lifetimes are needed to keep legacy release and successor ownership distinct; no compiler or payload build is involved.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original normal legacy removal/close precedes successor ownership. Immediately registered workers and both release barriers remain; body/inner-release/outer-release/worker failures aggregate without masking initial observation or reclaim errors. Shared helper ordinary results/errors settle on actual direct close with signal guards, while a separate deadline rejects unjoined ownership. Tracked root is retained before preparation; retention is not OS/descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Legacy protocol, both process statuses, stale false result, exact live successor fence, successful successor release and final released state remain unchanged; no successor identity is inferred from an old pathname.
 */
export const test_pluginbuildlock_legacy_observer_preserves_v3_successor =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-legacy-successor-");
    TestProject.retainTemporaryDirectory(root, "legacy-successor graph may outlive its worker close deadline");
    const lockDir = path.join(root, "entry.lock");
    const legacyReady = path.join(root, "legacy-ready");
    const legacyRelease = path.join(root, "legacy-release");
    const legacyReleased = path.join(root, "legacy-released");
    const successorLeaseFile = path.join(root, "successor-lease.json");
    const successorRelease = path.join(root, "successor-release");
    const successorResult = path.join(root, "successor-result.json");
    const workerScript = path.join(root, "legacy-successor-worker.cjs");

    fs.writeFileSync(
      workerScript,
      [
        `const fs = require("node:fs");`,
        `const os = require("node:os");`,
        `const path = require("node:path");`,
        `const { acquirePluginBuildLock } = require(${JSON.stringify(
          sourceBuildLibraryPath("acquirePluginBuildLock"),
        )});`,
        `const { releasePluginBuildLock } = require(${JSON.stringify(
          sourceBuildLibraryPath("releasePluginBuildLock"),
        )});`,
        `const lockDir = ${JSON.stringify(lockDir)};`,
        `const mode = process.env.LOCK_WORKER_MODE;`,
        `if (mode === "legacy") {`,
        `  fs.mkdirSync(lockDir);`,
        `  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ hostname: os.hostname(), pid: process.pid, startedAt: new Date().toISOString() }), "utf8");`,
        `  fs.writeFileSync(process.env.LOCK_WORKER_READY, "ready\\n", "utf8");`,
        `  waitFor(() => fs.existsSync(process.env.LOCK_WORKER_RELEASE), "legacy release");`,
        `  fs.rmSync(lockDir, { force: true, recursive: true });`,
        `  fs.writeFileSync(process.env.LOCK_WORKER_RESULT, "released\\n", "utf8");`,
        `} else if (mode === "successor") {`,
        `  let lease = null;`,
        `  const deadline = Date.now() + 120000;`,
        `  while (lease === null) {`,
        `    lease = acquirePluginBuildLock(lockDir);`,
        `    if (Date.now() > deadline) throw new Error("timed out acquiring successor");`,
        `    if (lease === null) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `  }`,
        `  fs.writeFileSync(process.env.LOCK_WORKER_READY, JSON.stringify(lease), "utf8");`,
        `  waitFor(() => fs.existsSync(process.env.LOCK_WORKER_RELEASE), "successor release");`,
        `  const released = releasePluginBuildLock(lockDir, lease);`,
        `  fs.writeFileSync(process.env.LOCK_WORKER_RESULT, JSON.stringify({ released }), "utf8");`,
        `} else {`,
        `  throw new Error("unknown worker mode: " + mode);`,
        `}`,
        `function waitFor(predicate, label) {`,
        `  const deadline = Date.now() + 120000;`,
        `  while (!predicate()) {`,
        `    if (Date.now() > deadline) throw new Error("timed out waiting for " + label);`,
        `    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `  }`,
        `}`,
        "",
      ].join("\n"),
      "utf8",
    );

    const workers: Array<ReturnType<typeof spawnNodeWorker>> = [];
    const failures: unknown[] = [];
    try {
      const legacyHolder = spawnNodeWorker({
        env: {
          LOCK_WORKER_MODE: "legacy",
          LOCK_WORKER_READY: legacyReady,
          LOCK_WORKER_RELEASE: legacyRelease,
          LOCK_WORKER_RESULT: legacyReleased,
        },
        script: workerScript,
      });
      workers.push(legacyHolder);
      void legacyHolder.catch(() => undefined);
      await waitForCondition(
        () => fs.existsSync(legacyReady),
        "legacy holder acquisition",
      );
      const observation = inspectPluginBuildLock(lockDir);
      if (observation.state !== "active") {
        // Outer cleanup releases/joins the registered worker while preserving
        // this original observation failure alongside cleanup failures.
        assert.fail(`expected active legacy holder, got ${observation.state}`);
      }
      assert.equal(observation.fence.protocol, "legacy");

      fs.writeFileSync(legacyRelease, "release\n", "utf8");
      await waitForCondition(
        () => fs.existsSync(legacyReleased),
        "legacy holder normal release",
      );
      const legacyResult = await legacyHolder;
      assert.equal(legacyResult.signal, null, "legacy worker terminated by signal");
      assert.equal(legacyResult.status, 0, legacyResult.stderr);

      const successor = spawnNodeWorker({
        env: {
          LOCK_WORKER_MODE: "successor",
          LOCK_WORKER_READY: successorLeaseFile,
          LOCK_WORKER_RELEASE: successorRelease,
          LOCK_WORKER_RESULT: successorResult,
        },
        script: workerScript,
      });
      workers.push(successor);
      void successor.catch(() => undefined);
      await waitForCondition(
        () => fs.existsSync(successorLeaseFile),
        "v3 successor acquisition",
      );
      const successorLease = JSON.parse(
        fs.readFileSync(successorLeaseFile, "utf8"),
      ) as { generation: string; protocol: "v3"; completionNonce: string };

      let reclaimed: boolean;
      let afterStaleReclaim: ReturnType<typeof inspectPluginBuildLock>;
      try {
        reclaimed = reclaimPluginBuildLock(lockDir, observation.fence);
        afterStaleReclaim = inspectPluginBuildLock(lockDir);
      } finally {
        try { fs.writeFileSync(successorRelease, "release\n", "utf8"); }
        catch (error) { failures.push(error); }
      }
      const successorWorker = await successor;
      assert.equal(successorWorker.signal, null, "successor worker terminated by signal");
      assert.equal(successorWorker.status, 0, successorWorker.stderr);

      assert.equal(reclaimed, false);
      assert.equal(afterStaleReclaim.state, "active");
      assert.deepEqual(
        afterStaleReclaim.state === "active" ? afterStaleReclaim.fence : null,
        {
          protocol: successorLease.protocol,
          generation: successorLease.generation,
        },
      );
      assert.deepEqual(JSON.parse(fs.readFileSync(successorResult, "utf8")), {
        released: true,
      });
      assert.deepEqual(inspectPluginBuildLock(lockDir), {
        state: "released",
      });
    } catch (error) {
      failures.push(error);
    } finally {
      for (const releaseFile of [legacyRelease, successorRelease]) {
        try {
          fs.writeFileSync(releaseFile, "release\n", "utf8");
        } catch (error) {
          failures.push(error);
        }
      }
      for (const outcome of await Promise.allSettled(workers)) {
        if (outcome.status === "rejected" && !failures.includes(outcome.reason))
          failures.push(outcome.reason);
      }
    }
    if (failures.length) throw new AggregateError(failures, "legacy-successor fencing or worker cleanup failed");
  };
