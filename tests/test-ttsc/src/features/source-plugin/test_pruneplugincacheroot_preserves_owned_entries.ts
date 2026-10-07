import { TestProject } from "../../../../utils/src/TestProject";
import {
  acquirePluginBuildLock,
  assert,
  fs,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
} from "../../internal/source-build-unit";

/**
 * Verifies a forced pruning pass preserves active generations and the
 * just-returned binary.
 *
 * A pass told to evict everything must still protect an entry whose build lock
 * shows an owner that cannot yet be disproven and the entry the caller is about
 * to use, so only the unowned old entry may be removed.
 *
 * 1. Seed four old cache entries: one under a young metadata-less legacy lock, one
 *    under a live current-protocol (v3) lease, the returned binary and an
 *    unowned one.
 * 2. Prune with a one-byte budget, a zero target and the returned entry protected.
 * 3. Require the locked and returned entries to remain and the unowned one to be
 *    removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Forces a zero-target collector pass over legacy, active generation, protected returned and unowned old entries.
 * @evidence contracts/testing.md#independent-expectations Authored directory contents and independently acquired ownership determine three survivors and one eviction.
 * @evidence contracts/testing.md#distinguishing-cases Four entries, all 31 days old and pruned with a one-byte budget and zero target: one under a young ownerless legacy lock directory, one under a live lease this process acquired with acquirePluginBuildLock (current v3 protocol), the entry passed in protectedEntries, and an unowned entry; only the unowned entry is removed. A held old-protocol (v2) lock is not exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling prunePluginCacheRoot and acquirePluginBuildLock over directories in a private temp tree; the one lease it takes is released in finally, and no consumer is installed, no native artifact is built and no host is started.
 */
export const test_pruneplugincacheroot_preserves_owned_entries = (): void => {
  const root = path.join(
    TestProject.tmpdir("ttsc-plugin-cache-owned-"),
    "plugins",
  );
  fs.mkdirSync(root, { recursive: true });
  const now = Date.now();
  const old = now - 31 * 24 * 60 * 60 * 1000;
  const seed = (name: string): string => {
    const directory = path.join(root, name);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "plugin"), name, "utf8");
    fs.writeFileSync(path.join(directory, ".last-used"), `${old}\n`, "utf8");
    return directory;
  };
  const activeLegacy = seed("active-legacy");
  const activeV3 = seed("active-v3");
  const returned = seed("returned");
  const evictable = seed("evictable");

  // Missing legacy ownership metadata cannot establish that its task ended.
  fs.mkdirSync(`${activeLegacy}.lock`);
  const legacyNow = new Date(now);
  fs.utimesSync(`${activeLegacy}.lock`, legacyNow, legacyNow);
  const lease = acquirePluginBuildLock(`${activeV3}.lock`);
  assert.ok(lease, "fixture failed to acquire an active v3 generation");
  try {
    prunePluginCacheRoot(root, {
      force: true,
      maxBytes: 1,
      now,
      protectedAgeMs: 0,
      protectedEntries: [returned],
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(activeLegacy), true);
    assert.equal(fs.existsSync(activeV3), true);
    assert.equal(fs.existsSync(returned), true);
    assert.equal(fs.existsSync(evictable), false);
  } finally {
    releasePluginBuildLock(`${activeV3}.lock`, lease);
  }
};
