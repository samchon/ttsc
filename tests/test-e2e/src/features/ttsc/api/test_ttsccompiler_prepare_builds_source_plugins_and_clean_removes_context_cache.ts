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
} from "../../../internal/ttsc/internal/compiler";

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
 * @evidence contracts/testing.md#independent-expectations The explicit context cache contract independently determines the root and plugin subdirectory. Returned count/path, filesystem presence and later root absence establish selected artifact location and deletion, not independent binary bytes, loaded image or invocation-local build provenance.
 * @evidence contracts/testing.md#distinguishing-cases One plugin and explicit cacheDir pin prepare-to-clean ownership; relative environment routing and multi-instance isolation are owned by adjacent entries.
 * @evidence contracts/testing.md#execution-ownership The named feature calls checkout built TtscCompiler through the existing shared subclass and selected resolveTsgo binary. Explicit cacheDir bypasses default shared-cache injection; this is actual descriptor/source preparation and cleanup, not packed installation.
 * @evidence contracts/e2e.md#necessary-boundary Actual source-plugin preparation followed by native cache removal checks selected ownership across the API. Presence/path alone do not prove a fresh native build or execution, while a pure path function cannot establish removal of that selected root.
 * @evidence contracts/e2e.md#shared-execution One preparation supplies original count/existence/path checks and one clean supplies deletion checks. The private explicit root preserves destructive ownership; API and returned path counts do not certify process, Program or cache-hit totals.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The registered project and private cache isolate deletion from the suite shared plugin cache; direct synchronous preparation returns before clean, and normal residual fixture cleanup is tracked. Neither direct return nor tracked cleanup certifies arbitrary descendant closure or forced-interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Count, binary existence/location, exact removed-root list and cache absence remain. The minimal Go input is submitted to preparation but its binary is not executed as a transform; fresh build provenance and executable image identity are not independently asserted.
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
