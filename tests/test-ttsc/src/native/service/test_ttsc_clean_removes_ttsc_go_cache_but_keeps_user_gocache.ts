import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies `ttsc clean` removes ttsc-owned Go cache but keeps user GOCACHE.
 *
 * `TTSC_GO_CACHE_DIR` is an explicit ttsc source-plugin cache location, while
 * `GOCACHE` belongs to the caller's broader Go toolchain. Clean should remove
 * the former together with ttsc's default cache roots and leave the latter
 * untouched.
 *
 * 1. Seed the default ttsc cache, a `TTSC_GO_CACHE_DIR`, and a user `GOCACHE`.
 * 2. Run `ttsc clean` with both Go cache environment variables set.
 * 3. Assert ttsc-owned caches are gone and `GOCACHE` still exists.
 */
export const test_ttsc_clean_removes_ttsc_go_cache_but_keeps_user_gocache =
  (): void => {
    const root = commonJsProject({
      "src/main.ts": `export const value = "clean-go-cache";\n`,
    });
    const cacheRoot = path.join(root, "node_modules", ".cache", "ttsc");
    const pluginCache = path.join(cacheRoot, "plugins");
    const defaultGoBuildCache = path.join(cacheRoot, "go-build");
    const ttscGoCache = path.join(root, ".ttsc-go-build");
    const userGoCache = path.join(root, ".user-go-cache");
    for (const target of [
      path.join(pluginCache, "a"),
      defaultGoBuildCache,
      ttscGoCache,
      userGoCache,
    ]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "seed"), "cache\n", "utf8");
    }

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        GOCACHE: userGoCache,
        TTSC_GO_CACHE_DIR: ttscGoCache,
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(pluginCache), false);
    assert.equal(fs.existsSync(defaultGoBuildCache), false);
    assert.equal(fs.existsSync(ttscGoCache), false);
    assert.equal(fs.existsSync(userGoCache), true);
  };
