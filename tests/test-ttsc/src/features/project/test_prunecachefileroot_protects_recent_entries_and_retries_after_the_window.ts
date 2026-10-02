import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pruneCacheFileRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneCacheFileRoot";

/**
 * Verifies a single-file cache part keeps entries used inside the protection
 * window and under the ceiling, and schedules its retry for when the window
 * has passed.
 *
 * A running launch may still be reading a recently used entry, so eviction
 * never removes one even when the part is over its ceiling. The collection then
 * records a marker earlier than a normal day so that the next launch past the
 * window collects again instead of waiting a full interval. A part under its
 * ceiling loses nothing to size eviction and records an ordinary interval.
 *
 * 1. Collect a part under its ceiling and assert every entry remains, then run
 *    an unforced pass an hour later and assert the ordinary marker skips it.
 * 2. Collect a part over its ceiling whose entries were all used inside the
 *    window and assert every entry remains.
 * 3. Collect again just before the window closes and assert the marker still
 *    suppresses the pass.
 * 4. Collect again just after the window closes and assert the retry evicts the
 *    oldest entries down to the target.
 *
 * @evidence contracts/testing.md#behavioral-verification pruneCacheFileRoot is run with explicit now over entries with literal mtimes: under the ceiling nothing is removed, over the ceiling with every entry inside the protection window nothing is removed, an unforced pass one millisecond before the window closes is suppressed by the marker the protected pass wrote, and an unforced pass one millisecond after it removes the two oldest entries.
 * @evidence contracts/testing.md#independent-expectations The expected survivors follow from authored sizes, ages and the stated policy: three 10-byte entries are 30 bytes over a 25-byte ceiling, an entry is protected while its age is within the 30-minute window, and eviction oldest first stops at the 10-byte target after two entries; the retry boundary is the window length itself, not a value read from the collector.
 * @evidence contracts/testing.md#distinguishing-cases Positives are the over-ceiling retry that evicts and the unforced pass that runs after the window; negatives are the under-ceiling part, the unforced pass an hour after an under-ceiling collection, the protected entries on an over-ceiling part and the unforced pass one millisecond early. The 30-day expiry and non-directory roots are owned by sibling tests.
 * @evidence contracts/testing.md#execution-ownership A unit test calling pruneCacheFileRoot directly on a temp directory whose file mtimes are set with utimes and whose clock is the explicit now option; no product host, native build or install is involved.
 */
export const test_prunecachefileroot_protects_recent_entries_and_retries_after_the_window =
  (): void => {
    const minute = 60 * 1000;
    const now = Date.now();
    const seed = (root: string, name: string, ageMs: number): string => {
      const file = path.join(root, name);
      fs.writeFileSync(file, "0123456789", "utf8");
      const time = new Date(now - ageMs);
      fs.utimesSync(file, time, time);
      return file;
    };

    const under = path.join(
      TestProject.tmpdir("ttsc-cache-file-under-"),
      "descriptors",
    );
    fs.mkdirSync(under, { recursive: true });
    const underEntries = [
      seed(under, "a.json", 120 * minute),
      seed(under, "b.json", 60 * minute),
    ];
    pruneCacheFileRoot(under, {
      force: true,
      maxBytes: 100,
      now,
      protectedAgeMs: 30 * minute,
      targetBytes: 10,
    });
    for (const file of underEntries)
      assert.equal(fs.existsSync(file), true, "an entry under the ceiling went");
    const third = seed(under, "c.json", 90 * minute);
    pruneCacheFileRoot(under, {
      maxBytes: 5,
      now: now + 60 * minute,
      protectedAgeMs: 30 * minute,
      targetBytes: 0,
    });
    for (const file of [...underEntries, third])
      assert.equal(
        fs.existsSync(file),
        true,
        "an unforced pass within the day ran after an under-ceiling collection",
      );

    const over = path.join(
      TestProject.tmpdir("ttsc-cache-file-protected-"),
      "capabilities",
    );
    fs.mkdirSync(over, { recursive: true });
    const oldest = seed(over, "a.json", 20 * minute);
    const older = seed(over, "b.json", 10 * minute);
    const recent = seed(over, "c.json", 5 * minute);
    const options = {
      maxBytes: 25,
      protectedAgeMs: 30 * minute,
      targetBytes: 10,
    };
    pruneCacheFileRoot(over, { ...options, force: true, now });
    for (const file of [oldest, older, recent])
      assert.equal(
        fs.existsSync(file),
        true,
        "an entry used inside the protection window was evicted",
      );

    pruneCacheFileRoot(over, { ...options, now: now + 30 * minute - 1 });
    for (const file of [oldest, older, recent])
      assert.equal(
        fs.existsSync(file),
        true,
        "the retry ran before the protection window closed",
      );

    pruneCacheFileRoot(over, { ...options, now: now + 30 * minute + 1 });
    assert.equal(fs.existsSync(oldest), false, "the oldest entry survived the retry");
    assert.equal(fs.existsSync(older), false, "the second oldest entry survived the retry");
    assert.equal(fs.existsSync(recent), true, "the newest entry was evicted past the target");
  };
