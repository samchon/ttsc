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
 * 1. Let a short-lived child acquire a v2 lock and exit without releasing it.
 * 2. Hold two observers at a barrier after both report that generation dead.
 * 3. Hold A's successor, release stale B, then assert one build and one binary.
 */
export const test_pluginbuildlock_fences_two_stale_observers = async () => {
  const root = TestProject.tmpdir("ttsc-lock-fence-");
  const lockDir = path.join(root, "entry.lock");
  const binaryPath = path.join(root, "entry", "plugin.exe");
  const libraryPath = sourceBuildLibraryPath();
  const seedFile = path.join(root, "seed.json");
  const buildReleaseFile = path.join(root, "build-release");
  const buildLog = path.join(root, "build.log");
  const seedScript = path.join(root, "seed.cjs");
  const observerScript = path.join(root, "observer.cjs");

  fs.writeFileSync(
    seedScript,
    [
      `const fs = require("node:fs");`,
      `const { acquirePluginBuildLock } = require(${JSON.stringify(libraryPath)});`,
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
    protocol: "v2";
  };

  fs.writeFileSync(
    observerScript,
    [
      `const fs = require("node:fs");`,
      `const path = require("node:path");`,
      `const { acquirePluginBuildLock, inspectPluginBuildLock, reclaimPluginBuildLock, releasePluginBuildLock } = require(${JSON.stringify(libraryPath)});`,
      `const lockDir = ${JSON.stringify(lockDir)};`,
      `const binaryPath = ${JSON.stringify(binaryPath)};`,
      `const buildLog = ${JSON.stringify(buildLog)};`,
      `const id = process.env.LOCK_WORKER_ID;`,
      `const readyFile = process.env.LOCK_WORKER_READY;`,
      `const observerReleaseFile = process.env.LOCK_WORKER_RELEASE;`,
      `const reclaimResultFile = process.env.LOCK_WORKER_RECLAIMED;`,
      `const buildingFile = process.env.LOCK_WORKER_BUILDING;`,
      `const buildReleaseFile = ${JSON.stringify(buildReleaseFile)};`,
      `const observation = inspectPluginBuildLock(lockDir, Date.now());`,
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
  await waitForCondition(
    () => fs.existsSync(readyA) && fs.existsSync(readyB),
    "both stale observers",
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(readyA, "utf8")), seed);
  assert.deepEqual(JSON.parse(fs.readFileSync(readyB, "utf8")), seed);

  fs.writeFileSync(releaseA, "release\n", "utf8");
  await waitForCondition(
    () => fs.existsSync(reclaimedA) && fs.existsSync(buildingA),
    "observer A to hold the successor generation",
  );
  const successorLease = JSON.parse(
    fs.readFileSync(buildingA, "utf8"),
  ) as { generation: string; protocol: "v2" };

  fs.writeFileSync(releaseB, "release\n", "utf8");
  await waitForCondition(
    () => fs.existsSync(reclaimedB),
    "stale observer B to attempt retirement",
  );
  const afterStaleReclaim = inspectPluginBuildLock(lockDir, Date.now());
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
    successorLease,
  );
  assert.equal(reports.filter((report) => report.reclaimed).length, 1);
  assert.equal(reports.filter((report) => report.built).length, 1);
  assert.equal(
    fs.readFileSync(buildLog, "utf8").trim().split(/\r?\n/).length,
    1,
  );
  assert.equal(fs.readFileSync(binaryPath, "utf8"), "plugin\n");
  assert.deepEqual(inspectPluginBuildLock(lockDir, Date.now()), {
    state: "released",
  });
  assert.equal(
    fs.existsSync(path.join(lockDir, "retired", seed.generation)),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(lockDir, "retired", successorLease.generation)),
    true,
  );
};
