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
} from "../../internal/source-build";

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
 */
export const test_pluginbuildlock_old_finalizer_preserves_successor =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-finalizer-");
    const lockDir = path.join(root, "entry.lock");
    const libraryPath = sourceBuildLibraryPath();
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
        `const { acquirePluginBuildLock, releasePluginBuildLock } = require(${JSON.stringify(libraryPath)});`,
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

    const oldHolder = spawnNodeWorker({
      env: {
        LOCK_LEASE_FILE: oldLeaseFile,
        LOCK_RELEASE_FILE: oldFinalizeFile,
        LOCK_RESULT_FILE: oldResultFile,
      },
      script: workerScript,
    });
    await waitForCondition(
      () => fs.existsSync(oldLeaseFile),
      "old holder acquisition",
    );
    const oldLease = JSON.parse(fs.readFileSync(oldLeaseFile, "utf8")) as {
      generation: string;
      protocol: "v2";
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
    await waitForCondition(
      () => fs.existsSync(successorLeaseFile),
      "successor acquisition",
    );
    const successorLease = JSON.parse(
      fs.readFileSync(successorLeaseFile, "utf8"),
    ) as { generation: string; protocol: "v2" };

    fs.writeFileSync(oldFinalizeFile, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(oldResultFile),
      "old finalizer result",
    );
    const oldResult = await oldHolder;
    assert.equal(oldResult.status, 0, oldResult.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(oldResultFile, "utf8")), {
      released: false,
    });
    const whileSuccessorHeld = inspectPluginBuildLock(lockDir, Date.now());
    assert.equal(whileSuccessorHeld.state, "active");
    assert.deepEqual(
      whileSuccessorHeld.state === "active"
        ? whileSuccessorHeld.fence
        : null,
      successorLease,
    );

    fs.writeFileSync(successorReleaseFile, "release\n", "utf8");
    const successorResult = await successor;
    assert.equal(successorResult.status, 0, successorResult.stderr);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(successorResultFile, "utf8")),
      { released: true },
    );
    assert.deepEqual(inspectPluginBuildLock(lockDir, Date.now()), {
      state: "released",
    });
    assert.equal(
      fs.existsSync(path.join(lockDir, "retired", oldLease.generation)),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(lockDir, "retired", successorLease.generation)),
      true,
    );
  };
