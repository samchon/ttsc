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
 * may reclaim it. After a shared barrier opens, exactly one retirement wins,
 * exactly one successor acquires and publishes, and the other process reuses
 * that result.
 *
 * 1. Let a short-lived child acquire a v2 lock and exit without releasing it.
 * 2. Hold two observers at a barrier after both report that generation dead.
 * 3. Release them together and assert one reclaim, one build, and one binary.
 */
export const test_pluginbuildlock_fences_two_stale_observers = async () => {
  const root = TestProject.tmpdir("ttsc-lock-fence-");
  const lockDir = path.join(root, "entry.lock");
  const binaryPath = path.join(root, "entry", "plugin.exe");
  const libraryPath = sourceBuildLibraryPath();
  const seedFile = path.join(root, "seed.json");
  const releaseFile = path.join(root, "release");
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
      `const releaseFile = ${JSON.stringify(releaseFile)};`,
      `const buildLog = ${JSON.stringify(buildLog)};`,
      `const id = process.env.LOCK_WORKER_ID;`,
      `const readyFile = process.env.LOCK_WORKER_READY;`,
      `const observation = inspectPluginBuildLock(lockDir, Date.now());`,
      `if (observation.state !== "abandoned") throw new Error("expected abandoned lock, got " + observation.state);`,
      `fs.writeFileSync(readyFile, JSON.stringify(observation.fence), "utf8");`,
      `waitFor(() => fs.existsSync(releaseFile), "observer release");`,
      `const reclaimed = reclaimPluginBuildLock(lockDir, observation.fence);`,
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
  const workerA = spawnNodeWorker({
    env: { LOCK_WORKER_ID: "a", LOCK_WORKER_READY: readyA },
    script: observerScript,
  });
  const workerB = spawnNodeWorker({
    env: { LOCK_WORKER_ID: "b", LOCK_WORKER_READY: readyB },
    script: observerScript,
  });
  await waitForCondition(
    () => fs.existsSync(readyA) && fs.existsSync(readyB),
    "both stale observers",
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(readyA, "utf8")), seed);
  assert.deepEqual(JSON.parse(fs.readFileSync(readyB, "utf8")), seed);

  fs.writeFileSync(releaseFile, "release\n", "utf8");
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
  const successor = reports.find((report) => report.built)?.generation;
  assert.equal(typeof successor, "string");
  assert.equal(
    fs.existsSync(path.join(lockDir, "retired", successor!)),
    true,
  );
};
