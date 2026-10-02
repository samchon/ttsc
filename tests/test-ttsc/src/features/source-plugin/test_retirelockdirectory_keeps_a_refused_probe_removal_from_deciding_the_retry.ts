import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { RetireLockDirectoryOperations } from "../../../../../packages/ttsc/src/internal/RetireLockDirectoryOperations";
import { retireLockDirectory } from "../../../../../packages/ttsc/src/internal/retireLockDirectory";

/**
 * Verifies a refused removal of the contention probe never decides the retry
 * of a lock retirement.
 *
 * On Windows a held generation is told apart from a permission refusal by
 * renaming a freshly created sibling probe between the same parents. Deleting
 * that empty probe can be refused for a moment by an indexer or scanner, and the
 * deletion only cleans up after an answer the rename already gave, so it must
 * neither throw out of the retry loop nor turn peer contention into a failure.
 * The cases drive the real directory renames and creations over a private
 * temporary tree through the injected operations, refusing exactly the
 * operations named below with the native error codes Windows reports.
 *
 * 1. Refuse the first retirement rename with EPERM as a peer's open file does,
 *    and refuse every probe removal with EBUSY.
 * 2. Require the retirement to return true after exactly one yield, with the
 *    held directory moved to its tombstone and the empty probe left behind.
 * 3. Contrast a code outside the contention set, a refused probe rename and a
 *    non-Windows platform, and require none of them to retry on the probe's
 *    word.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls retireLockDirectory with operations that delegate to the real filesystem except for an EPERM refusal of the first retirement rename on a platform value of win32 and an EBUSY refusal of every probe removal: it returns true after one yield, the source directory is at its tombstone and one empty probe directory remains; an EINVAL refusal, a refused probe rename and a linux platform each rethrow without a retry.
 * @evidence contracts/testing.md#independent-expectations The expected outcome follows from the retirement contract rather than the implementation: peer contention is proved by the probe rename, so a failed cleanup of the proof may not change the answer. The yield count, the directory states read from the real tree and the thrown error identities are literal observations, not values taken from the loop.
 * @evidence contracts/testing.md#distinguishing-cases The refused probe removal is the positive case that must still retry and succeed. The negatives differ by one property each: a refusal code the loop does not treat as contention, a probe that cannot itself be renamed (which must rethrow the original error and clean its probe), and a platform that never probes. The Windows-only path is reached through the injected platform value; real Windows refusal timing is not reproduced.
 * @evidence contracts/testing.md#execution-ownership A unit test calling retireLockDirectory with injected operations over directories in a TestProject.tmpdir tree; the injected platform and refusals simulate Windows native results, and no lock protocol, process or native build is involved.
 */
export function test_retirelockdirectory_keeps_a_refused_probe_removal_from_deciding_the_retry(): void {
  const refusal = (code: string): NodeJS.ErrnoException =>
    Object.assign(new Error(code), { code });
  const fixture = () => {
    const root = TestProject.tmpdir("ttsc-retire-lock-probe-");
    const source = path.join(root, "entry.lock");
    const destination = path.join(root, "entry.lock.retired-1");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "owner.json"), "{}\n");
    const probes = (): string[] =>
      fs.readdirSync(root).filter((name) => name.includes(".probe-"));
    return { root, source, destination, probes };
  };
  const operationsFor = (
    overrides: Partial<RetireLockDirectoryOperations>,
  ): RetireLockDirectoryOperations => ({
    renameSync: fs.renameSync,
    mkdirSync: (location) => fs.mkdirSync(location),
    rmSync: fs.rmSync,
    existsSync: fs.existsSync,
    platform: "win32",
    ...overrides,
  });

  // A refused probe removal leaves the empty probe and still retries.
  {
    const { source, destination, probes } = fixture();
    let renames = 0;
    const removals: string[] = [];
    let yields = 0;
    const retired = retireLockDirectory(
      source,
      destination,
      () => {
        yields++;
      },
      operationsFor({
        renameSync: (from, to) => {
          if (renames++ === 0 && from === source) throw refusal("EPERM");
          fs.renameSync(from, to);
        },
        rmSync: (location) => {
          removals.push(location);
          throw refusal("EBUSY");
        },
      }),
    );
    assert.equal(retired, true);
    assert.equal(yields, 1, "a refused probe removal changed the retry count");
    assert.equal(fs.existsSync(source), false);
    assert.equal(
      fs.readFileSync(path.join(destination, "owner.json"), "utf8"),
      "{}\n",
    );
    assert.equal(removals.length, 1);
    assert.equal(probes().length, 1, "the refused probe should remain");
    assert.deepEqual(
      fs.readdirSync(path.join(path.dirname(source), probes()[0]!)),
      [],
      "the leftover probe is an empty directory",
    );
  }

  // A refusal code outside the contention set is not retried and probes nothing.
  {
    const { source, destination, probes } = fixture();
    let probesCreated = 0;
    const failure = refusal("EINVAL");
    assert.throws(
      () =>
        retireLockDirectory(
          source,
          destination,
          () => assert.fail("must not yield"),
          operationsFor({
            renameSync: () => {
              throw failure;
            },
            mkdirSync: () => {
              probesCreated++;
            },
          }),
        ),
      (error) => error === failure,
    );
    assert.equal(probesCreated, 0);
    assert.deepEqual(probes(), []);
  }

  // A probe that cannot itself be renamed proves a lasting refusal: the original
  // error is thrown and the probe is cleaned up.
  {
    const { source, destination, probes } = fixture();
    const failure = refusal("EPERM");
    assert.throws(
      () =>
        retireLockDirectory(
          source,
          destination,
          () => assert.fail("must not yield"),
          operationsFor({
            renameSync: () => {
              throw failure;
            },
          }),
        ),
      (error) => error === failure,
    );
    assert.deepEqual(probes(), [], "a refused probe rename left its probe");
    assert.equal(fs.existsSync(source), true);
  }

  // Off Windows the same refusal is never probed or retried.
  {
    const { source, destination, probes } = fixture();
    const failure = refusal("EPERM");
    assert.throws(
      () =>
        retireLockDirectory(
          source,
          destination,
          () => assert.fail("must not yield"),
          operationsFor({
            platform: "linux",
            renameSync: () => {
              throw failure;
            },
          }),
        ),
      (error) => error === failure,
    );
    assert.deepEqual(probes(), []);
  }
}
