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
