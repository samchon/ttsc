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
 * 1. Seed one stale and one fresh entry under the workspace-local plugin cache.
 * 2. Resolve the default plugin cache root (no cacheDir/TTSC_CACHE_DIR override).
 * 3. Assert only the stale entry is removed and the fresh one is kept.
 */
export const test_resolveplugincacheroot_prunes_stale_cache_entries = () => {
  const root = TestProject.tmpdir("ttsc-cache-gc-");
  // node_modules pins `root` as the resolved workspace root.
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
    if (saved.cache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = saved.cache;
    if (saved.goCache === undefined) delete process.env.TTSC_GO_CACHE_DIR;
    else process.env.TTSC_GO_CACHE_DIR = saved.goCache;
  }
};
