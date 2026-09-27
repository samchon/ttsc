import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  pruneCacheFileRoot,
  recordCacheFileUse,
} from "../../internal/source-build";

/**
 * Verifies the single-file cache parts of the cache root are collected by the
 * plugin cache's policy.
 *
 * The descriptor evaluations, the capability answers, and the lowered orphan
 * sources are written as one file per key and were never removed, so a
 * persisted cache root grew with every superseded key (samchon/ttsc#1562). They
 * are now collected like the plugin binaries: at most once a day, an entry
 * unused for 30 days is evicted, and a hit records a use that keeps it.
 *
 * 1. Seed a part with an entry last used 31 days ago, a fresh entry, an old entry
 *    a hit then records a use of, and a staging file a crashed writer left 31
 *    days ago.
 * 2. Collect it, and assert only the old unused entry and the staging file are
 *    gone.
 * 3. Age the fresh entry, collect again without forcing, and assert the daily
 *    marker kept the second pass from running.
 */
export const test_prunecachefileroot_collects_unused_single_file_entries =
  (): void => {
    const root = path.join(
      TestProject.tmpdir("ttsc-cache-file-root-"),
      "descriptors",
    );
    fs.mkdirSync(root, { recursive: true });
    const now = Date.now();
    const old = new Date(now - 31 * 24 * 60 * 60 * 1000);
    const seed = (name: string, time: Date): string => {
      const file = path.join(root, name);
      fs.writeFileSync(file, "{}", "utf8");
      fs.utimesSync(file, time, time);
      return file;
    };
    const unused = seed("unused.json", old);
    const fresh = seed("fresh.json", new Date(now));
    const reused = seed("reused.json", old);
    const staging = seed("unused.json.123.abc.tmp", old);

    recordCacheFileUse(reused);
    pruneCacheFileRoot(root);
    assert.equal(fs.existsSync(unused), false, "an unused entry was kept");
    assert.equal(
      fs.existsSync(staging),
      false,
      "a stale staging file was kept",
    );
    assert.equal(fs.existsSync(fresh), true, "a fresh entry was removed");
    assert.equal(fs.existsSync(reused), true, "an entry in use was removed");

    fs.utimesSync(fresh, old, old);
    pruneCacheFileRoot(root);
    assert.equal(
      fs.existsSync(fresh),
      true,
      "a second collection ran within a day",
    );
    pruneCacheFileRoot(root, { force: true });
    assert.equal(fs.existsSync(fresh), false);
  };
