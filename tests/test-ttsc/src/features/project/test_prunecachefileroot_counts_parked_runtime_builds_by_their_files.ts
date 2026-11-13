import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { RuntimeTrash } from "../../../../../packages/ttsc/src/internal/RuntimeTrash";
import { pruneCacheFileRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneCacheFileRoot";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a ttsx runtime build parked in a `<key>.pending` directory is one
 * cache entry worth all its files' bytes, and leaves the store by a rename into
 * its trash.
 *
 * A run that ends before its fresh build is stored parks the build's outputs in
 * the store for the next run (samchon/ttsc#1859). A build whose key is never
 * requested again is never adopted, so collection is all that removes it; a
 * parked build counted as zero bytes would let such builds exceed the store's
 * ceiling without bound. Removal is a rename because a run may be adopting the
 * same directory by its own rename at that moment.
 *
 * 1. Seed a store with one 10-byte record file used 3 hours ago and two parked
 *    builds of 20 bytes each, in nested files, parked 2 hours ago and now.
 * 2. Collect with a 35-byte ceiling, a 25-byte target and a 30-minute window.
 * 3. Assert the record and the older parked build are gone, the latter into the
 *    trash, and the newer parked build remains intact.
 *
 * @evidence contracts/testing.md#behavioral-verification pruneCacheFileRoot runs with force over a real store tree; the record file, both parked directories and the trash are observed on disk afterwards.
 * @evidence contracts/testing.md#independent-expectations The authored sizes total 50 bytes over a 35-byte ceiling; oldest-first eviction removes the 10-byte record and then the 20-byte older parked build to reach 20 bytes, at most the 25-byte target, which is only reached if the parked builds count their nested files' bytes.
 * @evidence contracts/testing.md#distinguishing-cases A record file and two parked builds of different ages separate file removal, retirement of an old parked build and retention of a protected one; a parked build counted as zero bytes would leave the older one in place.
 * @evidence contracts/testing.md#execution-ownership A unit test calling pruneCacheFileRoot directly on a temporary directory whose modification times are set with utimes.
 */
export const test_prunecachefileroot_counts_parked_runtime_builds_by_their_files =
  (): void => {
    const root = path.join(
      TestProject.tmpdir("ttsc-cache-parked-"),
      "runtime-builds",
    );
    fs.mkdirSync(root, { recursive: true });
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const touch = (target: string, age: number): void => {
      const time = new Date(now - age);
      fs.utimesSync(target, time, time);
    };
    const record = path.join(root, "a.json");
    fs.writeFileSync(record, "0123456789");
    touch(record, 3 * hour);
    const parked = (name: string, age: number): string => {
      const directory = path.join(root, "key.pending", name);
      const output = path.join(directory, "outputs", "src", "main.js");
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, "0123456789");
      fs.writeFileSync(path.join(directory, "job.json"), "0123456789");
      touch(directory, age);
      return directory;
    };
    const older = parked("1-1-a", 2 * hour);
    const newer = parked("2-1-b", 0);

    pruneCacheFileRoot(root, {
      force: true,
      maxBytes: 35,
      now,
      protectedAgeMs: hour / 2,
      targetBytes: 25,
    });
    assert.equal(fs.existsSync(record), false);
    assert.equal(fs.existsSync(older), false, "the older parked build left");
    assert.equal(
      fs.readdirSync(path.join(root, RuntimeTrash.DIRNAME)).length,
      1,
      "it left by a rename into the trash",
    );
    assert.equal(
      fs.readFileSync(path.join(newer, "outputs", "src", "main.js"), "utf8"),
      "0123456789",
      "the protected parked build is intact",
    );
  };
