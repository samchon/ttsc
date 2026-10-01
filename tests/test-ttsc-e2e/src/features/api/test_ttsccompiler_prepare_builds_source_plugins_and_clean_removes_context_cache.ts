import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.prepare builds source plugins and clean removes the
 * context cache.
 *
 * `prepare()` pre-compiles Go source plugins and returns the binary paths so
 * the subsequent `compile()` call can skip the build step. `clean()` must then
 * remove exactly the `cacheDir` subtree and return the removed paths. Pins the
 * full lifecycle so CI pipelines that call `prepare` + `clean` between
 * invocations leave no dangling artifacts in explicit cache directories.
 *
 * 1. Create a project with a source plugin and an explicit `cacheDir`.
 * 2. Call `prepare()` and assert the returned binary path exists under
 *    `cacheDir/plugins`.
 * 3. Call `clean()` and assert the entire `cacheDir` is removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Prepares a descriptor-backed Go plugin under explicit cacheDir, checks the built binary exists below plugins, then checks clean returns and removes the chosen cache.
 * @evidence contracts/testing.md#independent-expectations The explicit context cache contract determines the root and plugin subdirectory; actual binary creation and later disappearance establish producer and cleanup behavior.
 * @evidence contracts/testing.md#distinguishing-cases One plugin and explicit cacheDir pin prepare-to-clean ownership; relative environment routing and multi-instance isolation are owned by adjacent entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named feature and runs actual Go plugin preparation plus API clean.
 * @evidence contracts/e2e.md#necessary-boundary The prepare result must identify a native artifact the compiler really produced, and clean must remove its owning cache; an in-memory path test cannot prove either effect.
 * @evidence contracts/e2e.md#shared-execution One preparation supplies every existence/path check and one clean supplies deletion checks. A private cache is necessary because this case destroys its prepared artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The registered project and private cache isolate deletion from the suite shared plugin cache; synchronous preparation finishes before cleanup, with residual fixture resources released at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Count, binary existence/location, exact removed-root list and cache absence remain. The minimal Go program is built but not executed as a transform.
 */
export const test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
    });
    writeSourcePlugin(root);
    const cacheDir = path.join(root, ".cache", "ttsc");
    const compiler = new TtscCompiler({ binary: tsgo, cacheDir, cwd: root });

    const prepared = compiler.prepare();

    assert.equal(prepared.length, 1);
    assert.equal(fs.existsSync(expectArrayValue(prepared, 0)), true);
    assert.equal(
      expectArrayValue(prepared, 0).startsWith(path.join(cacheDir, "plugins")),
      true,
    );

    const removed = compiler.clean();

    assert.deepEqual(removed, [cacheDir]);
    assert.equal(fs.existsSync(cacheDir), false);
  };
