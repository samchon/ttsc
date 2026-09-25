import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory } from "../../../../../packages/ttsc/lib/internal/retireLockDirectory.js";

/**
 * Verifies a build lock's retire waits out a peer's read of the held generation
 * instead of failing.
 *
 * Both build locks free a generation by renaming its directory onto a
 * tombstone, and every waiter reads the holder's record inside that directory.
 * Windows refuses to rename a directory while a file below it is open, so a
 * release overlapping a waiter's read threw `EPERM` and replaced the build's
 * own outcome (samchon/ttsc#1510). The retire now proves the refusal is a
 * peer's open file, by renaming an empty probe between the same parents, and
 * tries again after its yield.
 *
 * 1. Lay out a held generation, `current/owner.json`, and hold that file open, as
 *    a waiter's read does.
 * 2. Retire it, with a yield that ends the read, as the waiter's read ends.
 * 3. Assert the retire succeeded, the tombstone holds the record, and on Windows
 *    it waited exactly once; elsewhere an open file never refuses a rename.
 * 4. Assert a retire of a generation already gone, or onto an occupied tombstone,
 *    still answers `false` without waiting.
 */
export const test_buildlock_retire_waits_out_a_peers_read_of_the_held_generation =
  () => {
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
    const retiredNow = retireLockDirectory(current, tombstone, () => {
      yields += 1;
      if (read !== undefined) {
        fs.closeSync(read);
        read = undefined;
      }
    });
    if (read !== undefined) fs.closeSync(read);

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
