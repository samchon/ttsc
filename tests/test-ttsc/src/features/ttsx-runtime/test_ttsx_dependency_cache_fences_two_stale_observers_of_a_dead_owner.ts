import { TestProject } from "@ttsc/testing";

import {
  assert,
  dependencyCacheLibraryPath,
  fs,
  inspectDependencyBuildLock,
  path,
  spawnNodeWorker,
  waitForCondition,
} from "../../internal/dependency-cache";

/**
 * Verifies two stale observers of one dead-owner generation cannot both replace
 * it, so exactly one successor build proceeds.
 *
 * Both real child processes capture the same abandoned generation's fence
 * before either may act. Observer A reclaims and acquires the successor first
 * and stops there; only then does stale observer B attempt its reclaim. B must
 * find A's tombstone occupied, fail, and leave A's live successor intact — the
 * third-contender guarantee that at most one successor executes the build.
 *
 * 1. A short-lived child acquires a lock and exits without releasing it.
 * 2. Two observers report that generation abandoned and hold at a barrier.
 * 3. Release A to reclaim and hold the successor, then release B and assert one
 *    reclaim wins, one build-hold exists, and the successor is still current.
 */
export const test_ttsx_dependency_cache_fences_two_stale_observers_of_a_dead_owner =
  async () => {
    const root = TestProject.tmpdir("ttsx-depcache-fence-");
    const lockDir = path.join(root, "entry.lock");
    const libraryPath = dependencyCacheLibraryPath();

    const seedScript = path.join(root, "seed.cjs");
    fs.writeFileSync(
      seedScript,
      [
        `const fs = require("node:fs");`,
        `const { acquireDependencyBuildLock } = require(${JSON.stringify(libraryPath)});`,
        `const lease = acquireDependencyBuildLock(${JSON.stringify(lockDir)});`,
        `if (!lease) throw new Error("seed failed to acquire lock");`,
        `fs.writeFileSync(${JSON.stringify(path.join(root, "seed.json"))}, JSON.stringify(lease), "utf8");`,
        // Exit WITHOUT releasing: the owner pid is now dead, so observers see
        // the generation as abandoned.
        ``,
      ].join("\n"),
      "utf8",
    );
    const seeded = await spawnNodeWorker({ script: seedScript });
    assert.equal(seeded.status, 0, seeded.stderr);
    const seed = JSON.parse(
      fs.readFileSync(path.join(root, "seed.json"), "utf8"),
    ) as { generation: string };

    const observerScript = path.join(root, "observer.cjs");
    fs.writeFileSync(
      observerScript,
      [
        `const fs = require("node:fs");`,
        `const { acquireDependencyBuildLock, inspectDependencyBuildLock, reclaimDependencyBuildLock, releaseDependencyBuildLock } = require(${JSON.stringify(libraryPath)});`,
        `const lockDir = ${JSON.stringify(lockDir)};`,
        `const readyFile = process.env.OBS_READY;`,
        `const releaseFile = process.env.OBS_RELEASE;`,
        `const reclaimedFile = process.env.OBS_RECLAIMED;`,
        `const holdingFile = process.env.OBS_HOLDING;`,
        `const buildReleaseFile = ${JSON.stringify(path.join(root, "build-release"))};`,
        `const observation = inspectDependencyBuildLock(lockDir, Date.now());`,
        `if (observation.state !== "abandoned") throw new Error("expected abandoned, got " + observation.state);`,
        `fs.writeFileSync(readyFile, JSON.stringify(observation.fence), "utf8");`,
        `waitFor(() => fs.existsSync(releaseFile), "observer release");`,
        `const reclaimed = reclaimDependencyBuildLock(lockDir, observation.fence);`,
        `fs.writeFileSync(reclaimedFile, JSON.stringify({ reclaimed }), "utf8");`,
        `let holding = false;`,
        `const deadline = Date.now() + 120000;`,
        `for (;;) {`,
        `  const lease = acquireDependencyBuildLock(lockDir);`,
        `  if (lease) {`,
        `    holding = true;`,
        `    fs.writeFileSync(holdingFile, JSON.stringify(lease), "utf8");`,
        `    waitFor(() => fs.existsSync(buildReleaseFile), "build release");`,
        `    releaseDependencyBuildLock(lockDir, lease);`,
        `    break;`,
        `  }`,
        `  const state = inspectDependencyBuildLock(lockDir, Date.now());`,
        `  if (state.state === "active") break;`,
        `  if (Date.now() > deadline) throw new Error("timed out acquiring successor");`,
        `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `}`,
        `process.stdout.write(JSON.stringify({ holding, reclaimed }) + "\\n");`,
        `function waitFor(predicate, label) {`,
        `  const d = Date.now() + 120000;`,
        `  while (!predicate()) {`,
        `    if (Date.now() > d) throw new Error("timed out waiting for " + label);`,
        `    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `  }`,
        `}`,
        ``,
      ].join("\n"),
      "utf8",
    );

    const readyA = path.join(root, "ready-a.json");
    const readyB = path.join(root, "ready-b.json");
    const releaseA = path.join(root, "release-a");
    const releaseB = path.join(root, "release-b");
    const reclaimedA = path.join(root, "reclaimed-a.json");
    const reclaimedB = path.join(root, "reclaimed-b.json");
    const holdingA = path.join(root, "holding-a.json");
    const holdingB = path.join(root, "holding-b.json");

    const workerA = spawnNodeWorker({
      env: {
        OBS_HOLDING: holdingA,
        OBS_READY: readyA,
        OBS_RECLAIMED: reclaimedA,
        OBS_RELEASE: releaseA,
      },
      script: observerScript,
    });
    const workerB = spawnNodeWorker({
      env: {
        OBS_HOLDING: holdingB,
        OBS_READY: readyB,
        OBS_RECLAIMED: reclaimedB,
        OBS_RELEASE: releaseB,
      },
      script: observerScript,
    });

    await waitForCondition(
      () => fs.existsSync(readyA) && fs.existsSync(readyB),
      "both stale observers",
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(readyA, "utf8")), seed);
    assert.deepEqual(JSON.parse(fs.readFileSync(readyB, "utf8")), seed);

    // Let A reclaim and take the successor generation first.
    fs.writeFileSync(releaseA, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(reclaimedA) && fs.existsSync(holdingA),
      "observer A holds the successor",
    );
    const successorLease = JSON.parse(
      fs.readFileSync(holdingA, "utf8"),
    ) as { generation: string };

    // Now let stale observer B attempt its reclaim of the already-retired gen.
    fs.writeFileSync(releaseB, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(reclaimedB),
      "observer B reclaim attempt",
    );
    const whileHeld = inspectDependencyBuildLock(lockDir, Date.now());

    fs.writeFileSync(path.join(root, "build-release"), "release\n", "utf8");
    const results = await Promise.all([workerA, workerB]);
    for (const result of results) {
      assert.equal(result.status, 0, result.stderr);
    }
    const reports = results.map(
      (r) => JSON.parse(r.stdout) as { holding: boolean; reclaimed: boolean },
    );

    assert.deepEqual(JSON.parse(fs.readFileSync(reclaimedA, "utf8")), {
      reclaimed: true,
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(reclaimedB, "utf8")), {
      reclaimed: false,
    });
    assert.equal(fs.existsSync(holdingB), false);
    assert.equal(whileHeld.state, "active");
    assert.deepEqual(
      whileHeld.state === "active" ? whileHeld.fence : null,
      successorLease,
    );
    assert.equal(reports.filter((r) => r.reclaimed).length, 1);
    assert.equal(reports.filter((r) => r.holding).length, 1);
    assert.equal(
      fs.existsSync(path.join(lockDir, "retired", seed.generation)),
      true,
    );
  };
