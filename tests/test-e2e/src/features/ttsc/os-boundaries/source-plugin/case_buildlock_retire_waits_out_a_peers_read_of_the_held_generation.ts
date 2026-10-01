import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory as installedOperation } from "../../../../../../../packages/ttsc/lib/internal/retireLockDirectory.js";

/**
 * Verifies a build lock's retire waits out a peer's read of the held generation
 * instead of failing.
 *
 * Both build locks free a generation by renaming its directory onto a
 * tombstone, and every waiter reads the holder's record inside that directory.
 * Windows refuses to rename a directory while a file below it is open, so a
 * release overlapping a waiter's read threw `EPERM` and replaced the build's
 * own outcome (samchon/ttsc#1510). The retire checks parent rename capability
 * with an empty sibling probe and retries after its yield under the held-
 * generation ownership premise. This fixture controls the open-file cause;
 * the probe alone does not exclude source-specific filesystem restrictions.
 *
 * 1. Lay out a held generation, `current/owner.json`, and hold that file open, as
 *    a waiter's read does.
 * 2. Retire it, with a yield that ends the read, as the waiter's read ends.
 * 3. Assert the retire succeeded, the tombstone holds the record, and on Windows
 *    it waited exactly once; elsewhere an open file never refuses a rename.
 * 4. Assert a retire of a generation already gone, or onto an occupied tombstone,
 *    still answers `false` without waiting.
 *
 * @evidence contracts/testing.md#behavioral-verification retireLockDirectory must move the held owner record intact, remove current and probe names, yield exactly once for a Windows open file and never yield for missing or occupied retirement paths.
 * @evidence contracts/testing.md#independent-expectations An actually opened owner descriptor and literal owner bytes establish the rename premise; native Windows versus POSIX open-file semantics define the independent yield expectation, and a throwing yield exposes unexpected retries.
 * @evidence contracts/testing.md#distinguishing-cases Held descriptor, absent current and occupied nonempty tombstone distinguish transient contention from settled loss; exact directory listings expose leaked probes. Windows sharing refusal and POSIX rename success execute on their actual installation platforms.
 * @evidence contracts/testing.md#execution-ownership This named OS source-plugin entry receives the already installed candidate retirement primitive in the sole installation matrix and operates on native filesystem descriptors; it starts no compiler or plugin host.
 * @evidence contracts/e2e.md#necessary-boundary An actual open file interacting with native directory rename, especially Windows sharing refusal, is the connection being tested; supplied errno values cannot establish it. The same installed-SDK session retains actual Windows and POSIX observations.
 * @evidence contracts/e2e.md#shared-execution One held-generation fixture and one open descriptor serve the successful retirement and both settled negative calls, without Go builds or separate installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private current/retired tree isolates tombstones and probes. The yield closes the descriptor and an enclosing finally closes it on normal or exceptional retirement when still owned.
 * @evidence contracts/e2e.md#preserved-coverage The original success, byte-preservation, yield-count, probe-list and two false-result assertions remain in this entry, now executed through the candidate SDK on all six installation rows.
 */
export const case_buildlock_retire_waits_out_a_peers_read_of_the_held_generation =
  (retireLockDirectory: typeof installedOperation = installedOperation) => {
    const root = TestProject.tmpdir("ttsc-lock-retire-read-");
    const current = path.join(root, "current");
    const retired = path.join(root, "retired");
    const tombstone = path.join(retired, "0123456789abcdef0123456789abcdef");
    fs.mkdirSync(current, { recursive: true });
    fs.mkdirSync(retired);
    fs.writeFileSync(path.join(current, "owner.json"), "{}\n");

    let read: number | undefined = fs.openSync(
      path.join(current, "owner.json"),
      "r",
    );
    let yields = 0;
    let retiredNow: boolean;
    try {
      retiredNow = retireLockDirectory(current, tombstone, () => {
        yields += 1;
        if (read !== undefined) {
          fs.closeSync(read);
          read = undefined;
        }
      });
    } finally {
      if (read !== undefined) fs.closeSync(read);
    }

    assert.equal(retiredNow, true, "the held generation was retired");
    assert.equal(fs.existsSync(current), false);
    assert.equal(
      fs.readFileSync(path.join(tombstone, "owner.json"), "utf8"),
      "{}\n",
    );
    assert.equal(
      yields,
      process.platform === "win32" ? 1 : 0,
      "the retire waited only while the read held the generation",
    );
    assert.deepEqual(
      fs.readdirSync(root).sort(),
      ["retired"],
      "no probe was left behind",
    );
    assert.deepEqual(fs.readdirSync(retired), [path.basename(tombstone)]);

    const neverYields = (): void => {
      throw new Error("a settled retire waited");
    };
    assert.equal(retireLockDirectory(current, tombstone, neverYields), false);
    fs.mkdirSync(current);
    assert.equal(retireLockDirectory(current, tombstone, neverYields), false);
  };
