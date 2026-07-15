import { TestProject } from "@ttsc/testing";

import {
  acquireDependencyBuildLock,
  assert,
  dependencyCacheLibraryPath,
  fs,
  inspectDependencyBuildLock,
  path,
  reclaimDependencyBuildLock,
  releaseDependencyBuildLock,
  spawnNodeWorker,
} from "../../internal/dependency-cache";

/**
 * Verifies the dependency build lock classifies a dead owner as abandoned so a
 * crashed builder is recovered, and reports active and released states
 * correctly.
 *
 * A builder that crashes mid-build would otherwise wedge every waiter until the
 * generous steal timeout; keying abandonment on a same-host owner pid that is
 * no longer running lets the next contender reclaim immediately. The active and
 * released twins pin that a live owner is never stolen and a retired generation
 * reads back as released.
 *
 * 1. A child acquires a generation and exits without releasing it.
 * 2. Assert the lock reads abandoned, reclaim it, then acquire it live and assert
 *    it reads active with the live fence.
 * 3. Release the live generation and assert the lock reads released.
 */
export const test_ttsx_dependency_cache_recovers_from_a_dead_owner_and_reports_lock_states =
  async () => {
    const root = TestProject.tmpdir("ttsx-depcache-states-");
    const lockDir = path.join(root, "entry.lock");
    const seedFile = path.join(root, "seed.json");

    const seedScript = path.join(root, "seed.cjs");
    fs.writeFileSync(
      seedScript,
      [
        `const fs = require("node:fs");`,
        `const { acquireDependencyBuildLock } = require(${JSON.stringify(dependencyCacheLibraryPath())});`,
        `const lease = acquireDependencyBuildLock(${JSON.stringify(lockDir)});`,
        `if (!lease) throw new Error("seed failed to acquire lock");`,
        `fs.writeFileSync(${JSON.stringify(seedFile)}, JSON.stringify(lease), "utf8");`,
        // Exit without releasing — the owner pid is now dead.
        ``,
      ].join("\n"),
      "utf8",
    );
    const seeded = await spawnNodeWorker({ script: seedScript });
    assert.equal(seeded.status, 0, seeded.stderr);
    const seed = JSON.parse(fs.readFileSync(seedFile, "utf8")) as {
      generation: string;
    };

    // A crashed same-host owner reads as abandoned, not active.
    const abandoned = inspectDependencyBuildLock(lockDir, Date.now());
    assert.equal(abandoned.state, "abandoned");
    assert.deepEqual(
      abandoned.state === "abandoned" ? abandoned.fence : null,
      seed,
    );

    // Recover: retire the dead generation, then take it live.
    assert.equal(reclaimDependencyBuildLock(lockDir, seed), true);
    const lease = acquireDependencyBuildLock(lockDir);
    assert.notEqual(
      lease,
      null,
      "a fresh contender should acquire after recovery",
    );

    // A live local owner is never stolen.
    const active = inspectDependencyBuildLock(lockDir, Date.now());
    assert.equal(active.state, "active");
    assert.deepEqual(active.state === "active" ? active.fence : null, lease);

    // Ordinary release leaves the lock released.
    assert.equal(releaseDependencyBuildLock(lockDir, lease!), true);
    assert.deepEqual(inspectDependencyBuildLock(lockDir, Date.now()), {
      state: "released",
    });

    // The dead owner's late reclaim can no longer affect the released lock.
    assert.equal(reclaimDependencyBuildLock(lockDir, seed), false);
    assert.equal(
      fs.existsSync(path.join(lockDir, "retired", seed.generation)),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(lockDir, "retired", lease!.generation)),
      true,
    );
  };
