import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pruneCacheFileRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneCacheFileRoot";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a single-file cache part over its size ceiling loses its least
 * recently used entries first, down to the target.
 *
 * The ceiling is the plugin cache's (samchon/ttsc#1562): past it, entries are
 * evicted oldest use first down to the target, never one used within the
 * protection window, which a running launch may still be reading.
 *
 * 1. Seed three 10-byte entries used 3, 2 and 1 hours ago, and one used now.
 * 2. Collect with a 25-byte ceiling, a 20-byte target and a 30-minute window.
 * 3. Assert the two oldest are gone and the two newest remain.
 *
 * @evidence contracts/testing.md#behavioral-verification pruneCacheFileRoot is run with force, a 25-byte ceiling and a 20-byte target over four 10-byte entries last used 3 hours, 2 hours, 1 hour and now ago; the 3-hour and 2-hour entries are deleted and the 1-hour and current entries remain.
 * @evidence contracts/testing.md#independent-expectations The expected survivors follow from authored sizes and ages: 40 bytes exceeds the 25-byte ceiling, evicting oldest-first reaches the 20-byte target after exactly two 10-byte entries; the 30-minute protectedAgeMs value is passed but the expected result would be the same without it, so the protection rule is not verified here.
 * @evidence contracts/testing.md#distinguishing-cases One over-ceiling case, with ordering by age deciding which entries go (oldest first) and eviction stopping at the target; the below-ceiling case, the protected-window skip and its retry marker are owned by test_prunecachefileroot_protects_recent_entries_and_retries_after_the_window, and the 30-day expiry and the daily marker by test_prunecachefileroot_collects_unused_single_file_entries.
 * @evidence contracts/testing.md#execution-ownership A unit test calling pruneCacheFileRoot directly on a temp directory whose file mtimes are set with utimes; no product host, native build or install is involved.
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
