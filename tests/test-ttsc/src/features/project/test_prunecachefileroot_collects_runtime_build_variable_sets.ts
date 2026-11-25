import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pruneCacheFileRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneCacheFileRoot";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the variable sets a ttsx runtime build identity registered in its
 * `<identity>.environment` directory are collected as single-file entries, and
 * a directory they all left is removed.
 *
 * The runtime store registers each variable set a build of an identity read as
 * one immutable file below that identity's directory (samchon/ttsc#1870). Files
 * below a directory were not cache entries, so without this the sets of
 * identities never requested again would stay forever, as would their
 * directories.
 *
 * 1. Seed a store with an identity whose only set was used 40 days ago, and one
 *    with a set used 40 days ago and another used now.
 * 2. Collect with force.
 * 3. Assert both old sets and the emptied directory are gone, and the recent set
 *    and its directory remain.
 *
 * @evidence contracts/testing.md#behavioral-verification pruneCacheFileRoot runs with force over a real store tree; the set files and their directories are observed on disk afterwards.
 * @evidence contracts/testing.md#independent-expectations The 30-day age policy removes a set unused for 40 days and keeps one used now, so the expected files follow from the authored times.
 * @evidence contracts/testing.md#distinguishing-cases An identity whose sets all aged out and one that keeps a recent set separate removing an emptied directory from keeping a used one; a collector that ignored nested files would keep every set.
 * @evidence contracts/testing.md#execution-ownership A unit test calling pruneCacheFileRoot directly on a temporary directory whose modification times are set with utimes.
 */
export const test_prunecachefileroot_collects_runtime_build_variable_sets =
  (): void => {
    const root = path.join(
      TestProject.tmpdir("ttsc-cache-sets-"),
      "runtime-builds",
    );
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const set = (identity: string, name: string, age: number): string => {
      const file = path.join(root, `${identity}.environment`, `${name}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(["MODE"]));
      const time = new Date(now - age);
      fs.utimesSync(file, time, time);
      return file;
    };
    const abandoned = set("abandoned", "a", 40 * day);
    const stale = set("used", "b", 40 * day);
    const recent = set("used", "c", 0);

    pruneCacheFileRoot(root, { force: true, now });
    assert.equal(fs.existsSync(abandoned), false, "an unused set ages out");
    assert.equal(
      fs.existsSync(path.dirname(abandoned)),
      false,
      "a directory its sets all left is removed",
    );
    assert.equal(fs.existsSync(stale), false);
    assert.equal(fs.existsSync(recent), true, "a used set is kept");
  };
