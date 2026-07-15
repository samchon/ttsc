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
 * Verifies a stale legacy observer cannot retire a v2 successor.
 *
 * A legacy holder may normally remove the whole legacy lock path after another
 * process captured its fence. The successor must live in an ownership namespace
 * that this delayed legacy reclaim can never rename, even though the observer's
 * deterministic retirement destination has not previously been populated.
 *
 * 1. Observe a live legacy holder, then let it remove its lock normally.
 * 2. Hold a v2 successor in a second child process.
 * 3. Apply the stale legacy fence and assert the successor remains current.
 */
export const test_pluginbuildlock_legacy_observer_preserves_v2_successor =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-legacy-successor-");
    const lockDir = path.join(root, "entry.lock");
    const libraryPath = sourceBuildLibraryPath();
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
        `const { acquirePluginBuildLock, releasePluginBuildLock } = require(${JSON.stringify(libraryPath)});`,
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

    const legacyHolder = spawnNodeWorker({
      env: {
        LOCK_WORKER_MODE: "legacy",
        LOCK_WORKER_READY: legacyReady,
        LOCK_WORKER_RELEASE: legacyRelease,
        LOCK_WORKER_RESULT: legacyReleased,
      },
      script: workerScript,
    });
    await waitForCondition(
      () => fs.existsSync(legacyReady),
      "legacy holder acquisition",
    );
    const observation = inspectPluginBuildLock(lockDir, Date.now());
    if (observation.state !== "active") {
      fs.writeFileSync(legacyRelease, "release\n", "utf8");
      await legacyHolder;
      assert.fail(`expected active legacy holder, got ${observation.state}`);
    }
    assert.equal(observation.fence.protocol, "legacy");

    fs.writeFileSync(legacyRelease, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(legacyReleased),
      "legacy holder normal release",
    );
    const legacyResult = await legacyHolder;
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
    await waitForCondition(
      () => fs.existsSync(successorLeaseFile),
      "v2 successor acquisition",
    );
    const successorLease = JSON.parse(
      fs.readFileSync(successorLeaseFile, "utf8"),
    ) as { generation: string; protocol: "v2" };

    let reclaimed: boolean;
    let afterStaleReclaim: ReturnType<typeof inspectPluginBuildLock>;
    try {
      reclaimed = reclaimPluginBuildLock(lockDir, observation.fence);
      afterStaleReclaim = inspectPluginBuildLock(lockDir, Date.now());
    } finally {
      fs.writeFileSync(successorRelease, "release\n", "utf8");
    }
    const successorWorker = await successor;
    assert.equal(successorWorker.status, 0, successorWorker.stderr);

    assert.equal(reclaimed, false);
    assert.equal(afterStaleReclaim.state, "active");
    assert.deepEqual(
      afterStaleReclaim.state === "active" ? afterStaleReclaim.fence : null,
      successorLease,
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(successorResult, "utf8")), {
      released: true,
    });
    assert.deepEqual(inspectPluginBuildLock(lockDir, Date.now()), {
      state: "released",
    });
  };
