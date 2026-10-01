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
} from "../../../internal/ttsc/internal/dependency-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built lease operations let child A finalize only after child B acquires the successor; assertions require A release false, exact live B fence, B normal release true, both tombstones and stale parent release false.
 * @evidence contracts/testing.md#independent-expectations Generation fences and deterministic tombstones independently require an old generation to lack authority over a successor; observed leases supplied by actual acquisitions define the expected identities.
 * @evidence contracts/testing.md#distinguishing-cases Delayed old finalization and duplicate parent finalization must fail while the successor stays active; the same successor subsequently releases successfully. Dead-owner observation and competing reclaim are separate fenced cases.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry invokes built lock operations in two actual independent holder processes and the observing parent, with barrier-controlled interleaving rather than elapsed timing.
 * @evidence contracts/e2e.md#necessary-boundary An actual delayed child finalizer must encounter another process's acquired native directory generation; a pure lease predicate cannot establish filesystem retirement or successor survival across those lifetimes.
 * @evidence contracts/e2e.md#shared-execution One worker script and one lock root serve old and successor holders; two simultaneous holder lifetimes are essential because one must retain its old finalizer while the other owns current. No compiler or consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated root retains deterministic old/successor generations and barriers control acquisition and finalization. Finally releases both workers and awaits their settlements even after parent assertion failure, preventing barrier timeouts from leaking into later cases.
 * @evidence contracts/e2e.md#preserved-coverage All original status, release-result, active-fence, released-state, tombstone and stale-release assertions remain unchanged; failure-path cleanup adds no skipped assertion or artificial abandonment claim.
 */
export async function test_ttsx_dependency_cache_old_finalizer_cannot_release_a_successor() {
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
    let successor: ReturnType<typeof spawnNodeWorker> | undefined;
    try {
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

    successor = spawnNodeWorker({
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
    } finally {
      fs.writeFileSync(oldFinalizeFile, "release\n", "utf8");
      fs.writeFileSync(successorReleaseFile, "release\n", "utf8");
      await Promise.allSettled(successor === undefined ? [oldHolder] : [oldHolder, successor]);
    }
  }
