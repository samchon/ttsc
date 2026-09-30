import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
  sourceBuildLibraryPath,
  spawnNodeWorker,
  waitForCondition,
} from "../../internal/source-build";

/**
 * Verifies two stale observers cannot both replace one abandoned generation.
 *
 * Both real child processes capture the same dead owner's fence before either
 * may reclaim it. Observer A first acquires a successor and stops inside its
 * build. Only then may stale observer B act, so B must leave that visible
 * successor intact and eventually reuse its binary.
 *
 * 1. Let a short-lived child acquire a v3 lock and exit without releasing it.
 * 2. Hold two observers at a barrier after both report that generation dead.
 * 3. Hold A's successor, release stale B, then assert one build and one binary.
 *
 * @evidence contracts/testing.md#behavioral-verification Two child observers capture the same abandoned generation, but only A may reclaim and build; stale B must leave A's successor active and reuse the single published binary before the final released state.
 * @evidence contracts/testing.md#independent-expectations Explicit ready/reclaim/build/release files establish ordering. Literal reclaimed true/false reports, a one-line build log, no B building marker and plugin bytes independently distinguish one producer from two.
 * @evidence contracts/testing.md#distinguishing-cases An exited seed, two equal stale fences, active successor, stale retirement rejection, single build and retained seed/successor tombstones cover generation replacement rather than merely final path equality.
 * @evidence contracts/testing.md#execution-ownership The exported async entry generates a seed and two observer workers that call shipped acquire/inspect/reclaim/release APIs, with real process identities and shared native lock paths.
 * @evidence contracts/e2e.md#necessary-boundary Separate stale observers must retain old capabilities while a live successor owns current; native atomic directory rename and process-backed owner observation jointly establish the fencing boundary.
 * @evidence contracts/e2e.md#shared-execution Both observers share one script, binary path, abandoned seed and cache-key lock. Two live observer lifetimes are required to preserve conflicting captured fences; only A performs the literal artifact publication.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Role-specific barriers isolate A/B observations within one private root, and both workers are awaited after the build-release marker on success. Every spawned observer is registered immediately; finally opens both observation barriers and the build barrier and joins all registered workers even after an earlier assertion fails.
 * @evidence contracts/e2e.md#preserved-coverage All original seed/fence, process outcome, reclaimed/built counts, build-log bytes, successor identity and tombstone assertions remain. Fixture artifact bytes prove publication and serialization, not Go compiler correctness.
 */
export const test_pluginbuildlock_fences_two_stale_observers = async () => {
  const root = TestProject.tmpdir("ttsc-lock-fence-");
  const lockDir = path.join(root, "entry.lock");
  const binaryPath = path.join(root, "entry", "plugin.exe");
  const seedFile = path.join(root, "seed.json");
  const buildReleaseFile = path.join(root, "build-release");
  const buildLog = path.join(root, "build.log");
  const seedScript = path.join(root, "seed.cjs");
  const observerScript = path.join(root, "observer.cjs");

  fs.writeFileSync(
    seedScript,
    [
      `const fs = require("node:fs");`,
      `const { acquirePluginBuildLock } = require(${JSON.stringify(
        sourceBuildLibraryPath("acquirePluginBuildLock"),
      )});`,
      `const lease = acquirePluginBuildLock(${JSON.stringify(lockDir)});`,
      `if (!lease) throw new Error("seed failed to acquire lock");`,
      `fs.writeFileSync(${JSON.stringify(seedFile)}, JSON.stringify(lease), "utf8");`,
      "",
    ].join("\n"),
    "utf8",
  );
  const seeded = await spawnNodeWorker({ script: seedScript });
  assert.equal(seeded.status, 0, seeded.stderr);
  const seed = JSON.parse(fs.readFileSync(seedFile, "utf8")) as {
    generation: string;
    protocol: "v3";
    completionNonce: string;
  };

  fs.writeFileSync(
    observerScript,
    [
      `const fs = require("node:fs");`,
      `const path = require("node:path");`,
      `const { acquirePluginBuildLock } = require(${JSON.stringify(
        sourceBuildLibraryPath("acquirePluginBuildLock"),
      )});`,
      `const { inspectPluginBuildLock } = require(${JSON.stringify(
        sourceBuildLibraryPath("inspectPluginBuildLock"),
      )});`,
      `const { reclaimPluginBuildLock } = require(${JSON.stringify(
        sourceBuildLibraryPath("reclaimPluginBuildLock"),
      )});`,
      `const { releasePluginBuildLock } = require(${JSON.stringify(
        sourceBuildLibraryPath("releasePluginBuildLock"),
      )});`,
      `const lockDir = ${JSON.stringify(lockDir)};`,
      `const binaryPath = ${JSON.stringify(binaryPath)};`,
      `const buildLog = ${JSON.stringify(buildLog)};`,
      `const id = process.env.LOCK_WORKER_ID;`,
      `const readyFile = process.env.LOCK_WORKER_READY;`,
      `const observerReleaseFile = process.env.LOCK_WORKER_RELEASE;`,
      `const reclaimResultFile = process.env.LOCK_WORKER_RECLAIMED;`,
      `const buildingFile = process.env.LOCK_WORKER_BUILDING;`,
      `const buildReleaseFile = ${JSON.stringify(buildReleaseFile)};`,
      `const observation = inspectPluginBuildLock(lockDir);`,
      `if (observation.state !== "abandoned") throw new Error("expected abandoned lock, got " + observation.state);`,
      `fs.writeFileSync(readyFile, JSON.stringify(observation.fence), "utf8");`,
      `waitFor(() => fs.existsSync(observerReleaseFile), "observer release");`,
      `const reclaimed = reclaimPluginBuildLock(lockDir, observation.fence);`,
      `fs.writeFileSync(reclaimResultFile, JSON.stringify({ reclaimed }), "utf8");`,
      `let built = false;`,
      `let generation = null;`,
      `const deadline = Date.now() + 120000;`,
      `for (;;) {`,
      `  if (fs.existsSync(binaryPath)) break;`,
      `  const lease = acquirePluginBuildLock(lockDir);`,
      `  if (lease) {`,
      `    generation = lease.generation;`,
      `    try {`,
      `      if (!fs.existsSync(binaryPath)) {`,
      `        built = true;`,
      `        fs.writeFileSync(buildingFile, JSON.stringify(lease), "utf8");`,
      `        waitFor(() => fs.existsSync(buildReleaseFile), "build release");`,
      `        fs.appendFileSync(buildLog, id + "\\n", "utf8");`,
      `        fs.mkdirSync(path.dirname(binaryPath), { recursive: true });`,
      `        const temporary = binaryPath + "." + id + ".tmp";`,
      `        fs.writeFileSync(temporary, "plugin\\n", "utf8");`,
      `        fs.renameSync(temporary, binaryPath);`,
      `      }`,
      `    } finally {`,
      `      releasePluginBuildLock(lockDir, lease);`,
      `    }`,
      `    break;`,
      `  }`,
      `  if (Date.now() > deadline) throw new Error("timed out acquiring successor");`,
      `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
      `}`,
      `process.stdout.write(JSON.stringify({ built, generation, reclaimed }) + "\\n");`,
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

  const readyA = path.join(root, "ready-a.json");
  const readyB = path.join(root, "ready-b.json");
  const releaseA = path.join(root, "release-a");
  const releaseB = path.join(root, "release-b");
  const reclaimedA = path.join(root, "reclaimed-a.json");
  const reclaimedB = path.join(root, "reclaimed-b.json");
  const buildingA = path.join(root, "building-a.json");
  const buildingB = path.join(root, "building-b.json");
  const workers: Array<ReturnType<typeof spawnNodeWorker>> = [];
  try {
    const workerA = spawnNodeWorker({
      env: {
        LOCK_WORKER_BUILDING: buildingA,
        LOCK_WORKER_ID: "a",
        LOCK_WORKER_READY: readyA,
        LOCK_WORKER_RECLAIMED: reclaimedA,
        LOCK_WORKER_RELEASE: releaseA,
      },
      script: observerScript,
    });
    workers.push(workerA);
    void workerA.catch(() => undefined);
    const workerB = spawnNodeWorker({
      env: {
        LOCK_WORKER_BUILDING: buildingB,
        LOCK_WORKER_ID: "b",
        LOCK_WORKER_READY: readyB,
        LOCK_WORKER_RECLAIMED: reclaimedB,
        LOCK_WORKER_RELEASE: releaseB,
      },
      script: observerScript,
    });
    workers.push(workerB);
    void workerB.catch(() => undefined);
    await waitForCondition(
      () => fs.existsSync(readyA) && fs.existsSync(readyB),
      "both stale observers",
    );
    const seedFence = { protocol: seed.protocol, generation: seed.generation };
    assert.deepEqual(JSON.parse(fs.readFileSync(readyA, "utf8")), seedFence);
    assert.deepEqual(JSON.parse(fs.readFileSync(readyB, "utf8")), seedFence);

    fs.writeFileSync(releaseA, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(reclaimedA) && fs.existsSync(buildingA),
      "observer A to hold the successor generation",
    );
    const successorLease = JSON.parse(fs.readFileSync(buildingA, "utf8")) as {
      generation: string;
      protocol: "v3";
      completionNonce: string;
    };

    fs.writeFileSync(releaseB, "release\n", "utf8");
    await waitForCondition(
      () => fs.existsSync(reclaimedB),
      "stale observer B to attempt retirement",
    );
    const afterStaleReclaim = inspectPluginBuildLock(lockDir);
    fs.writeFileSync(buildReleaseFile, "release\n", "utf8");
    const results = await Promise.all([workerA, workerB]);
    for (const result of results) {
      assert.equal(result.status, 0, result.stderr);
    }
    const reports = results.map(
      (result) =>
        JSON.parse(result.stdout) as {
          built: boolean;
          generation: string | null;
          reclaimed: boolean;
        },
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(reclaimedA, "utf8")), {
      reclaimed: true,
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(reclaimedB, "utf8")), {
      reclaimed: false,
    });
    assert.equal(fs.existsSync(buildingB), false);
    assert.equal(afterStaleReclaim.state, "active");
    assert.deepEqual(
      afterStaleReclaim.state === "active" ? afterStaleReclaim.fence : null,
      {
        protocol: successorLease.protocol,
        generation: successorLease.generation,
      },
    );
    assert.equal(reports.filter((report) => report.reclaimed).length, 1);
    assert.equal(reports.filter((report) => report.built).length, 1);
    assert.equal(
      fs.readFileSync(buildLog, "utf8").trim().split(/\r?\n/).length,
      1,
    );
    assert.equal(fs.readFileSync(binaryPath, "utf8"), "plugin\n");
    assert.deepEqual(inspectPluginBuildLock(lockDir), {
      state: "released",
    });
    assert.equal(
      fs.existsSync(path.join(`${lockDir}.v3`, "retired", seed.generation)),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(`${lockDir}.v3`, "retired", successorLease.generation),
      ),
      true,
    );
  } finally {
    const releaseErrors: unknown[] = [];
    for (const releaseFile of [releaseA, releaseB, buildReleaseFile]) {
      try {
        fs.writeFileSync(releaseFile, "release\n", "utf8");
      } catch (error) {
        releaseErrors.push(error);
      }
    }
    await Promise.allSettled(workers);
    if (releaseErrors.length !== 0) {
      throw new AggregateError(releaseErrors, "worker release barriers failed");
    }
  }
};
