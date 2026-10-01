import { TestProject } from "../../../../utils/src/TestProject";

import {
  acquirePluginBuildLock,
  assert,
  fs,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
} from "../../internal/source-build-unit";

/** Active generations and the just-returned binary survive an LRU pass. *
 * @evidence contracts/testing.md#behavioral-verification Forces a zero-target collector pass over legacy, active generation, protected returned and unowned old entries.
 * @evidence contracts/testing.md#independent-expectations Authored directory contents and independently acquired ownership determine three survivors and one eviction.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts young metadata-less ownership, a real same-process lease, explicit return protection and an unprotected evictable entry.
 * @evidence contracts/testing.md#execution-ownership test_pruneplugincacheroot_preserves_owned_entries is discovered once under src/features/source-plugin and directly invokes the authored lock/cache operation over test-owned paths. This case installs no consumer, builds no artifact and starts no product host; the temporary-directory owner and its explicit lease finally blocks release its state.
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
  const activeV2 = seed("active-v2");
  const returned = seed("returned");
  const evictable = seed("evictable");

  // A young metadata-less legacy holder cannot yet be disproven alive.
  fs.mkdirSync(`${activeLegacy}.lock`);
  const legacyNow = new Date(now);
  fs.utimesSync(`${activeLegacy}.lock`, legacyNow, legacyNow);
  const lease = acquirePluginBuildLock(`${activeV2}.lock`);
  assert.ok(lease, "fixture failed to acquire an active v2 generation");
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
    assert.equal(fs.existsSync(activeV2), true);
    assert.equal(fs.existsSync(returned), true);
    assert.equal(fs.existsSync(evictable), false);
  } finally {
    releasePluginBuildLock(`${activeV2}.lock`, lease);
  }
};
