import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../internal/compiler";

/**
 * Verifies two TtscCompiler instances isolate their source-plugin caches by
 * `context.env` alone, without mutating the shared `process.env`.
 *
 * `context.env` is documented as the immutable per-instance environment. Two
 * instances in one process must be able to select isolated caches through
 * `context.env` while the source-plugin build reads that effective environment
 * (rather than the ambient `process.env`), so their artifacts never cross. This
 * is the multi-instance guarantee of RA-07: `prepare()` routes through the same
 * `loadProjectPlugins({ env })` seam that plugin-backed `compile`, `transform`,
 * and resident startup use, so proving isolation here exercises that shared
 * seam.
 *
 * Transformation direction with a negative twin: each instance pins a distinct
 * project-local `TTSC_CACHE_DIR` only in `context.env`, and the two builds land
 * their binaries under their own roots. If the build ignored `context.env` and
 * read the ambient environment, both instances would share one cache root and
 * their prepared binaries would collide.
 *
 * 1. Build the same source plugin through two instances whose `context.env`
 *    names different project-local cache roots.
 * 2. Snapshot `process.env.TTSC_CACHE_DIR` before and after.
 * 3. Assert each binary lives under its own cache root, the two paths differ,
 *    and the ambient `TTSC_CACHE_DIR` was never mutated.
 */
export const test_ttsccompiler_prepare_isolates_instances_by_context_env_cache =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
    });
    writeSourcePlugin(root);
    const cacheRootA = path.join(root, ".cache", "a", "plugins");
    const cacheRootB = path.join(root, ".cache", "b", "plugins");

    const ambientBefore = process.env.TTSC_CACHE_DIR;

    const preparedA = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/a" },
    }).prepare();
    const preparedB = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/b" },
    }).prepare();

    const ambientAfter = process.env.TTSC_CACHE_DIR;
    const binaryA = expectArrayValue(preparedA, 0);
    const binaryB = expectArrayValue(preparedB, 0);

    assert.equal(binaryA.startsWith(cacheRootA + path.sep), true);
    assert.equal(binaryB.startsWith(cacheRootB + path.sep), true);
    assert.notEqual(binaryA, binaryB);
    assert.equal(fs.existsSync(binaryA), true);
    assert.equal(fs.existsSync(binaryB), true);
    // Neither instance's cache root may contain the other's binary.
    assert.equal(binaryA.startsWith(cacheRootB + path.sep), false);
    assert.equal(binaryB.startsWith(cacheRootA + path.sep), false);
    // Isolation came from context.env, not a mutated shared process.env.
    assert.equal(ambientAfter, ambientBefore);
  };
