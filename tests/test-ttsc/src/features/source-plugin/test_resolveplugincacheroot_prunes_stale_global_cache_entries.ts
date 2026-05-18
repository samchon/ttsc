import {
  assert,
  fs,
  os,
  path,
  resolvePluginCacheRoot,
} from "../../internal/source-build";

/**
 * Verifies resolvePluginCacheRoot prunes stale global cache entries.
 *
 * The global source-plugin cache keeps binaries after a project stops using a
 * plugin so branch switches can reuse them. To keep that cache bounded, ttsc
 * opportunistically removes entries whose last-used metadata is older than the
 * retention window.
 *
 * 1. Point XDG_CACHE_HOME at an isolated temp directory.
 * 2. Create one stale and one fresh global plugin cache entry.
 * 3. Resolve the default plugin cache root and assert only the stale entry is
 *    removed.
 */
export const test_resolveplugincacheroot_prunes_stale_global_cache_entries =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cache-gc-"));
    const previousCacheHome = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = path.join(root, "cache-home");
    try {
      const pluginCache = path.join(
        process.env.XDG_CACHE_HOME,
        "ttsc",
        "plugins",
      );
      const stale = path.join(pluginCache, "stale");
      const fresh = path.join(pluginCache, "fresh");
      fs.mkdirSync(stale, { recursive: true });
      fs.mkdirSync(fresh, { recursive: true });
      fs.writeFileSync(path.join(stale, "plugin"), "stale\n", "utf8");
      fs.writeFileSync(path.join(fresh, "plugin"), "fresh\n", "utf8");
      const now = Date.now();
      fs.writeFileSync(
        path.join(stale, ".last-used"),
        `${now - 31 * 24 * 60 * 60 * 1000}\n`,
        "utf8",
      );
      fs.writeFileSync(path.join(fresh, ".last-used"), `${now}\n`, "utf8");

      assert.equal(resolvePluginCacheRoot(root), pluginCache);
      assert.equal(fs.existsSync(stale), false);
      assert.equal(fs.existsSync(fresh), true);
    } finally {
      if (previousCacheHome === undefined) delete process.env.XDG_CACHE_HOME;
      else process.env.XDG_CACHE_HOME = previousCacheHome;
    }
  };
