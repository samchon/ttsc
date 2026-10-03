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
 * @evidence contracts/testing.md#execution-ownership The supplied candidate primitive, or default built workspace operation, is directly called in the same process with actual native descriptors. An installed import alone does not establish compiler/plugin/product protocol necessity.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Native open-file inputs belong to the direct retirement operation. Exact tests/test-ttsc/src/features/source-plugin/test_retirelockdirectory_observes_native_open_file_retirement.ts preserves the original eight observations and fd setup; authored1c9ec660a801f6da2116ca4462abd59608142210 is UNEXECUTED. No separately necessary installed publication connection is asserted by this matrix.
 * @evidence contracts/e2e.md#shared-execution Existing tree/descriptor/three direct calls remain until exact direct survivor selection/execution permits duplicate-call removal; no achieved E2E preparation or process reduction is claimed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private current/retired tree isolates tombstones/probes. The supported yield closes the descriptor and finally attempts closure if still owned; operation and close failures are both preserved. No arbitrary process or native sharing errno is synthesized.
 * @evidence contracts/e2e.md#preserved-coverage Original retiretrue/currentabsence/owner bytes/Win1-POSIX0 yield/root and retired listings/missing and occupied false observations remain. Actual survivor execution and installation coverage are not certified; donor remains until surviving execution.
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
    let retiredNow: boolean | undefined;
    const retirementErrors: unknown[] = [];
    try {
      retiredNow = retireLockDirectory(current, tombstone, () => {
        yields += 1;
        if (read !== undefined) {
          fs.closeSync(read);
          read = undefined;
        }
      });
    } catch (error) {
      retirementErrors.push(error);
    } finally {
      if (read !== undefined) {
        try { fs.closeSync(read); }
        catch (error) { retirementErrors.push(error); }
      }
    }
    if (retirementErrors.length !== 0)
      throw new AggregateError(retirementErrors, "retirement or owned descriptor close failed");

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
