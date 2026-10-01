import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pruneCacheFileRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneCacheFileRoot";


/**
 * Verifies a single-file cache part over its size ceiling loses its least
 * recently used entries first, and keeps the ones used within the protection
 * window.
 *
 * The ceiling is the plugin cache's (samchon/ttsc#1562): past it, entries are
 * evicted oldest use first down to the target, never one used within the
 * protection window, which a running launch may still be reading.
 *
 * 1. Seed three 10-byte entries used 3, 2 and 1 hours ago, and one used now.
 * 2. Collect with a 25-byte ceiling, a 20-byte target and a 30-minute window.
 * 3. Assert the two oldest are gone and the two newest remain.
 *
 * @evidence contracts/testing.md#behavioral-verification The collector removes the two oldest ten-byte entries and keeps the newest and protected entries under the 25-byte ceiling and 20-byte target.
 * @evidence contracts/testing.md#independent-expectations Authored byte sizes, 3/2/1-hour ages and a 30-minute protection window independently determine the expected surviving pair.
 * @evidence contracts/testing.md#distinguishing-cases Four 10-byte entries used 3 hours, 2 hours, 1 hour and now against a 25-byte ceiling and 20-byte target: only the two least recently used are evicted, and the entries inside or near the 30-minute protection window remain.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry exercises the owning operations directly on isolated fixture inputs; no product host, native artifact build or consumer installation executes.
 */
export const test_prunecachefileroot_evicts_the_least_recently_used_past_the_ceiling =
  (): void => {
    const root = path.join(
      TestProject.tmpdir("ttsc-cache-file-ceiling-"),
      "ttsx-orphan",
    );
    fs.mkdirSync(root, { recursive: true });
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const seed = (name: string, age: number): string => {
      const file = path.join(root, name);
      fs.writeFileSync(file, "0123456789", "utf8");
      const time = new Date(now - age);
      fs.utimesSync(file, time, time);
      return file;
    };
    const oldest = seed("a.js", 3 * hour);
    const older = seed("b.js", 2 * hour);
    const recent = seed("c.js", hour);
    const current = seed("d.js", 0);

    pruneCacheFileRoot(root, {
      force: true,
      maxBytes: 25,
      now,
      protectedAgeMs: hour / 2,
      targetBytes: 20,
    });
    assert.equal(fs.existsSync(oldest), false);
    assert.equal(fs.existsSync(older), false);
    assert.equal(fs.existsSync(recent), true);
    assert.equal(fs.existsSync(current), true);
  };
