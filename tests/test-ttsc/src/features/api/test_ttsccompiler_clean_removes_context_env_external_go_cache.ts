import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.clean removes the instance's `context.env`-injected
 * external Go build cache while preserving a user `GOCACHE`.
 *
 * `clean()` must derive its removal targets from the same effective environment
 * (`{ ...process.env, ...context.env }`) that `prepare()`/`compile()` build
 * with, so a `TTSC_GO_CACHE_DIR` supplied only in `context.env` is owned and
 * removed by that instance. A `GOCACHE` value is the caller's broader Go
 * toolchain cache and must never be removed. Reading the ambient `process.env`
 * instead — which never held `TTSC_GO_CACHE_DIR` here — would leave the
 * instance's external cache behind.
 *
 * Transformation direction with a negative twin: the ttsc-owned external cache
 * arrives only through `context.env.TTSC_GO_CACHE_DIR` (ambient unset), and the
 * user cache arrives through `context.env.GOCACHE`. Clean must remove the
 * former and keep the latter, without setting `TTSC_GO_CACHE_DIR` on the shared
 * `process.env`.
 *
 * 1. Seed a project-local plugin cache, an external `TTSC_GO_CACHE_DIR`, and a
 *    user `GOCACHE`, with `TTSC_GO_CACHE_DIR` absent from `process.env`.
 * 2. Run `clean()` on an instance whose `context.env` carries both Go caches.
 * 3. Assert the plugin cache and external Go cache are removed, the user
 *    `GOCACHE` survives, and `process.env.TTSC_GO_CACHE_DIR` is still unset.
 */
export const test_ttsccompiler_clean_removes_context_env_external_go_cache =
  () => {
    const root = createProject();
    const pluginCache = path.join(root, ".cache", "ttsc", "plugins");
    const externalGoCache = path.join(root, "instance-go-cache");
    const userGoCache = path.join(root, "user-go-cache");
    for (const target of [pluginCache, externalGoCache, userGoCache]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "seed"), "cache\n", "utf8");
    }

    const previousTtscGoCache = process.env.TTSC_GO_CACHE_DIR;
    delete process.env.TTSC_GO_CACHE_DIR;
    try {
      const compiler = new TtscCompiler({
        binary: tsgo,
        cwd: root,
        env: {
          TTSC_CACHE_DIR: ".cache/ttsc",
          TTSC_GO_CACHE_DIR: externalGoCache,
          GOCACHE: userGoCache,
        },
      });

      const removed = compiler.clean();

      assert.equal(removed.includes(externalGoCache), true);
      assert.equal(fs.existsSync(externalGoCache), false);
      assert.equal(fs.existsSync(pluginCache), false);
      assert.equal(fs.existsSync(userGoCache), true);
      // The fix must not lean on mutating the shared process environment.
      assert.equal(process.env.TTSC_GO_CACHE_DIR, undefined);
    } finally {
      if (previousTtscGoCache === undefined)
        delete process.env.TTSC_GO_CACHE_DIR;
      else process.env.TTSC_GO_CACHE_DIR = previousTtscGoCache;
    }
  };
