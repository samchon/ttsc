import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the installed build-lock retirement waits out a peer's read of the
 * held generation instead of failing.
 *
 * Both build locks free a generation by renaming its directory onto a
 * tombstone, while every waiter reads the holder's record inside it. Windows
 * refuses that rename while a file below it is open, so a release overlapping a
 * read failed with `EPERM` (samchon/ttsc#1510). The source unit
 * `test_retirelockdirectory_observes_native_open_file_retirement` owns this
 * contract for the authored operation; this case runs the operation the packed
 * SDK publishes.
 *
 * 1. Open `current/owner.json`, as a waiter's read does, and retire with a yield
 *    that closes it.
 * 2. Require the record moved intact, one yield on Windows and none elsewhere, and
 *    no probe left behind.
 * 3. Require a missing generation and an occupied tombstone to answer `false`
 *    without waiting.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed retirement must move the held record intact, remove current, yield once on Windows and never elsewhere, and refuse both settled negatives without waiting.
 * @evidence contracts/testing.md#independent-expectations A real open descriptor, literal owner bytes and each platform's rename semantics establish the expectations; exact directory listings expose leftovers.
 * @evidence contracts/testing.md#distinguishing-cases An open-file retirement contrasts with a missing source and an occupied destination; a throwing yield detects any retry of either negative.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation passes the operation its packed SDK publishes; this case starts no child or product host.
 * @evidence contracts/e2e.md#necessary-boundary The packed SDK's own retirement module must agree with the native rename refusal; the source unit cannot establish what the installation publishes.
 * @evidence contracts/e2e.md#shared-execution One installation serves every installed-operation case of its entry.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns a fresh tracked root and closes its descriptor on success or failure.
 * @evidence contracts/e2e.md#preserved-coverage Restores the installed-publication run of the deleted tests/test-ttsc build-lock retirement case, whose assertions the source unit keeps.
 */
export function case_buildlock_retire_waits_out_a_peers_read_of_the_held_generation(
  retireLockDirectory: (
    current: string,
    tombstone: string,
    yieldToPeer: () => void,
  ) => boolean,
): void {
  const root = TestProject.tmpdir("ttsc-installed-retire-");
  const current = path.join(root, "current");
  const retired = path.join(root, "retired");
  const tombstone = path.join(retired, "0123456789abcdef0123456789abcdef");
  fs.mkdirSync(current);
  fs.mkdirSync(retired);
  fs.writeFileSync(path.join(current, "owner.json"), "{}\n", "utf8");
  let descriptor: number | undefined = fs.openSync(
    path.join(current, "owner.json"),
    "r",
  );
  let yields = 0;
  let retiredNow: boolean;
  try {
    retiredNow = retireLockDirectory(current, tombstone, () => {
      yields++;
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
      }
    });
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
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
  assert.deepEqual(fs.readdirSync(root).sort(), ["retired"]);
  assert.deepEqual(fs.readdirSync(retired), [path.basename(tombstone)]);

  const neverYields = (): void => {
    throw new Error("a settled retire waited");
  };
  assert.equal(retireLockDirectory(current, tombstone, neverYields), false);
  fs.mkdirSync(current);
  assert.equal(retireLockDirectory(current, tombstone, neverYields), false);
}
