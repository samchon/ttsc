import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectDependencyBuildLock,
  path,
  reclaimDependencyBuildLock,
  releaseDependencyBuildLock,
  spawnNodeWorker,
  waitForCondition,
  writeLockHolderScript,
} from "../../internal/dependency-cache";

/**
 * Verifies an old dependency-lock holder's delayed finalizer cannot release its
 * successor.
 *
 * Fences the exact race from the issue: holder A's `finally` runs only after a
 * successor B already owns the lock. Because the only way to free `current` is
 * to create the retiring generation's tombstone, A's deterministic tombstone
 * already exists, so its late rename fails atomically and B stays current. A
 * pathname-blind `rmSync` would instead have deleted B's live lock.
 *
 * 1. A child acquires generation A; the parent reclaims (retires) A.
 * 2. A second child acquires successor B, then A's delayed `finally` runs.
 * 3. Assert A reports release failure, B remains the active current generation,
 *    and B later releases normally.
 */
export const test_ttsx_dependency_cache_old_finalizer_cannot_release_a_successor =
  async () => {
    const root = TestProject.tmpdir("ttsx-depcache-finalizer-");
    const lockDir = path.join(root, "entry.lock");
    const workerScript = writeLockHolderScript(root, lockDir);

    const oldLeaseFile = path.join(root, "old-lease.json");
    const oldFinalizeFile = path.join(root, "old-finalize");
    const oldResultFile = path.join(root, "old-result.json");
    const successorLeaseFile = path.join(root, "successor-lease.json");
    const successorReleaseFile = path.join(root, "successor-release");
    const successorResultFile = path.join(root, "successor-result.json");

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
    };
    assert.equal(
      reclaimDependencyBuildLock(lockDir, oldLease),
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
    ) as { generation: string };

    // Only now let A's normal `finally` run — B is already current.
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

    const whileSuccessorHeld = inspectDependencyBuildLock(lockDir, Date.now());
    assert.equal(whileSuccessorHeld.state, "active");
    assert.deepEqual(
      whileSuccessorHeld.state === "active" ? whileSuccessorHeld.fence : null,
      successorLease,
    );

    fs.writeFileSync(successorReleaseFile, "release\n", "utf8");
    const successorResult = await successor;
    assert.equal(successorResult.status, 0, successorResult.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(successorResultFile, "utf8")), {
      released: true,
    });
    assert.deepEqual(inspectDependencyBuildLock(lockDir, Date.now()), {
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

    // The parent's late reclaim of the already-retired generation A must also
    // fail without touching the released state.
    assert.equal(releaseDependencyBuildLock(lockDir, oldLease), false);
  };
