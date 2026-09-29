import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  resolvePluginCacheRoot,
} from "../../internal/source-build";

/**
 * Verifies resolvePluginCacheRoot prunes stale cache entries.
 *
 * The workspace-local plugin cache keeps binaries after a project stops using a
 * plugin so branch switches reuse them; across many tsgo/plugin version bumps
 * that would grow unbounded. ttsc opportunistically evicts entries whose
 * last-used metadata is older than the 30-day retention window. Scoped to the
 * project cache root only — never a shared/global location.
 *
 * 1. Seed evictable, fresh and legacy-protected entries plus lock artifacts.
 * 2. Seed a future-dated GC marker hard-linked to an external sentinel, as can
 *    happen in a pre-populated project cache.
 * 3. Resolve the default plugin cache root (no cacheDir/TTSC_CACHE_DIR override).
 * 4. Assert the unprotected old entry is removed while an ownerless legacy lock
 *    protects its binary and old v2 coordination remains available.
 * 5. Point another default plugin-cache leaf at an external directory and assert
 *    opportunistic GC never follows the junction to delete its entries.
 */
export const test_resolveplugincacheroot_prunes_stale_cache_entries = () => {
  const root = TestProject.tmpdir("ttsc-cache-gc-");
  // Give the fixture its own workspace boundary even when the machine's temp
  // parent happens to contain another test's node_modules installation.
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  const saved = {
    cache: process.env.TTSC_CACHE_DIR,
    goCache: process.env.TTSC_GO_CACHE_DIR,
  };
  delete process.env.TTSC_CACHE_DIR;
  delete process.env.TTSC_GO_CACHE_DIR;
  try {
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

    assert.equal(resolvePluginCacheRoot(root), pluginCache);
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

    resolvePluginCacheRoot(linkedRoot);
    assert.equal(
      fs.existsSync(outsideEntry),
      true,
      "plugin cache GC escaped through its root junction",
    );
  } finally {
    if (saved.cache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = saved.cache;
    if (saved.goCache === undefined) delete process.env.TTSC_GO_CACHE_DIR;
    else process.env.TTSC_GO_CACHE_DIR = saved.goCache;
  }
};
