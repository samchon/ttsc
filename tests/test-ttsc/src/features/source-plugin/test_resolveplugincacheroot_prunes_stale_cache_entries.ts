import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  path,
  resolvePluginCacheRoot,
} from "../../internal/source-build-unit";

/**
 * Verifies resolvePluginCacheRoot prunes stale cache entries.
 *
 * The workspace-local plugin cache keeps binaries after a project stops using a
 * plugin so branch switches reuse them; across many tsgo/plugin version bumps
 * that would grow unbounded. ttsc opportunistically evicts entries whose
 * last-used metadata is older than the 30-day retention window. Scoped to the
 * project cache root only — never a shared/global location.
 *
 * 1. Seed evictable, fresh and legacy-protected entries with lock artifacts, and a
 *    future-dated GC marker hard-linked to an external sentinel.
 * 2. Resolve the default plugin cache root with no cache directory override.
 * 3. Assert the unprotected old entry is removed, an ownerless legacy lock
 *    protects its binary, old version-two coordination remains and the external
 *    sentinel is unchanged.
 * 4. Point another default plugin-cache leaf at an external directory through a
 *    junction and assert opportunistic GC never follows it.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolvePluginCacheRoot on owned filesystem fixtures and asserts stale eviction, fresh and uncertain-lock retention, unchanged external hardlink contents and no traversal through the cache-root link.
 * @evidence contracts/testing.md#independent-expectations The 30-day retention and owned default-root contracts independently specify the authored old/fresh dates and protected external sentinel bytes.
 * @evidence contracts/testing.md#distinguishing-cases Evictable old entry versus a fresh entry and an old entry held by an ownerless legacy lock (kept), version-two coordination and a retired-lock directory left in place, a future-dated GC marker hard-linked to an outside file (that file must not change), and a plugins directory replaced by a junction to an outside cache whose stale entry must survive. No live lock holder or build process is exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling resolvePluginCacheRoot (which runs the opportunistic prune) over disposable workspaces under the temp directory, with an explicitly supplied empty invocation environment; global process.env remains unchanged. No consumer is installed, no native code is built and no host is started.
 */
export const test_resolveplugincacheroot_prunes_stale_cache_entries = () => {
  const root = TestProject.tmpdir("ttsc-cache-gc-");
  // Give the fixture its own workspace boundary even when the machine's temp
  // parent happens to contain another test's node_modules installation.
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  {
    const pluginCache = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
    );
    const stale = path.join(pluginCache, "stale");
    const evictable = path.join(pluginCache, "evictable");
    const fresh = path.join(pluginCache, "fresh");
    const lock = path.join(pluginCache, "stale.lock");
    const v2Lock = path.join(pluginCache, "stale.lock.v2");
    const retiredLegacy = path.join(pluginCache, "stale.lock.retired-deadbeef");
    fs.mkdirSync(stale, { recursive: true });
    fs.mkdirSync(evictable, { recursive: true });
    fs.mkdirSync(fresh, { recursive: true });
    fs.mkdirSync(lock, { recursive: true });
    fs.mkdirSync(v2Lock, { recursive: true });
    fs.mkdirSync(retiredLegacy, { recursive: true });
    fs.writeFileSync(path.join(stale, "plugin"), "stale\n", "utf8");
    fs.writeFileSync(path.join(evictable, "plugin"), "evictable\n", "utf8");
    fs.writeFileSync(path.join(fresh, "plugin"), "fresh\n", "utf8");
    const now = Date.now();
    const abandoned = new Date(now - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(lock, abandoned, abandoned);
    fs.writeFileSync(
      path.join(stale, ".last-used"),
      `${now - 31 * 24 * 60 * 60 * 1000}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(evictable, ".last-used"),
      `${now - 31 * 24 * 60 * 60 * 1000}\n`,
      "utf8",
    );
    fs.writeFileSync(path.join(fresh, ".last-used"), `${now}\n`, "utf8");
    const externalMarker = path.join(root, "external-plugin-marker.txt");
    const futureMarker = `${now + 24 * 60 * 60 * 1000}\n`;
    fs.writeFileSync(externalMarker, futureMarker, "utf8");
    fs.linkSync(externalMarker, path.join(pluginCache, ".gc-last-run"));

    assert.equal(resolvePluginCacheRoot(root, undefined, {}), pluginCache);
    assert.equal(fs.existsSync(evictable), false);
    assert.equal(fs.existsSync(stale), true);
    assert.equal(fs.existsSync(fresh), true);
    assert.equal(
      fs.existsSync(lock),
      true,
      "unconfirmed legacy ownership protects its binary and lock",
    );
    assert.equal(fs.existsSync(v2Lock), true);
    assert.equal(fs.existsSync(retiredLegacy), true);
    assert.equal(
      fs.readFileSync(externalMarker, "utf8"),
      futureMarker,
      "plugin cache GC mutated an external hard-linked marker",
    );

    const linkedRoot = path.join(root, "linked-project");
    fs.mkdirSync(linkedRoot);
    fs.writeFileSync(
      path.join(linkedRoot, "pnpm-workspace.yaml"),
      "packages: []\n",
    );
    const linkedParent = path.join(
      linkedRoot,
      "node_modules",
      ".cache",
      "ttsc",
    );
    const outsidePluginCache = path.join(root, "outside-plugin-cache");
    const outsideEntry = path.join(outsidePluginCache, "outside-stale");
    fs.mkdirSync(linkedParent, { recursive: true });
    fs.mkdirSync(outsideEntry, { recursive: true });
    fs.writeFileSync(path.join(outsideEntry, "plugin"), "outside\n", "utf8");
    fs.writeFileSync(
      path.join(outsideEntry, ".last-used"),
      `${now - 31 * 24 * 60 * 60 * 1000}\n`,
      "utf8",
    );
    fs.symlinkSync(
      outsidePluginCache,
      path.join(linkedParent, "plugins"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const outsideMtime = fs.statSync(outsidePluginCache).mtimeMs;
    resolvePluginCacheRoot(linkedRoot, undefined, {});
    assert.equal(
      fs.existsSync(outsideEntry),
      true,
      "plugin cache GC escaped through its root junction",
    );
    assert.equal(fs.readFileSync(path.join(outsideEntry, "plugin"), "utf8"), "outside\n");
    assert.equal(fs.readFileSync(path.join(outsideEntry, ".last-used"), "utf8"), `${now - 31 * 24 * 60 * 60 * 1000}\n`);
    assert.equal(fs.statSync(outsidePluginCache).mtimeMs, outsideMtime);
    assert.equal(fs.existsSync(path.join(outsidePluginCache, ".gc-last-run")), false);
    assert.equal(fs.lstatSync(path.join(linkedParent, "plugins")).isSymbolicLink(), true);
  }
};
