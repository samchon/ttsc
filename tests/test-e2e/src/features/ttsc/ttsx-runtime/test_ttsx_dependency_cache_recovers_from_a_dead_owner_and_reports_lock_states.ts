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
} from "../../../internal/ttsc/internal/dependency-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Built lease operations acquire in a child that exits unreleased, inspect its exact abandoned fence, reclaim it, acquire a live parent successor, then verify active, normal released and stale reclaim false plus both tombstones.
 * @evidence contracts/testing.md#independent-expectations The seed's process exit independently establishes owner death and its published acquired lease identifies the expected abandoned generation; the running parent independently establishes live ownership rather than an invented PID.
 * @evidence contracts/testing.md#distinguishing-cases Dead owner permits reclaim, live successor remains active, normal release reports released, and duplicate stale reclaim fails without disturbing released state. Separate stale-observer and old-finalizer cases own concurrent contender schedules.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry invokes built protocol operations in one real seed process and the parent; direct admission units separately own elapsed-budget policy without creating an artificial death state.
 * @evidence contracts/e2e.md#necessary-boundary Native process death must be recognized through persisted lease metadata and connect to atomic retirement and successor acquisition; pure elapsed-time or fabricated owner-record assertions cannot verify this observation.
 * @evidence contracts/e2e.md#shared-execution One short-lived seed is the only additional process required; all inspected, reclaimed, acquired and released states share one lock root and no compiler or installation preparation repeats.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The seed exits before parent inspection, so its dead state is genuine rather than timing dependent. The successor is released normally and a fenced finally release also closes ownership after an assertion failure; TestProject owns the isolated directory.
 * @evidence contracts/e2e.md#preserved-coverage All original seed-status, abandoned/live exact-fence, acquisition, release, released-state, duplicate-reclaim and per-generation tombstone assertions are retained; no semantic case is removed in this contract enrollment.
 */
export async function test_ttsx_dependency_cache_recovers_from_a_dead_owner_and_reports_lock_states() {
    const root = TestProject.tmpdir("ttsx-depcache-states-");
    const lockDir = path.join(root, "entry.lock");
    const seedFile = path.join(root, "seed.json");

    const seedScript = path.join(root, "seed.cjs");
    fs.writeFileSync(
      seedScript,
      [
        `const fs = require("node:fs");`,
        `const { acquireDependencyBuildLock } = require(${JSON.stringify(dependencyCacheLibraryPath("acquireDependencyBuildLock"))});`,
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

    try {
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
    } finally {
      releaseDependencyBuildLock(lockDir, lease!);
    }
  }
