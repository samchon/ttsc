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
  writeBasicProject,
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
 * @evidence contracts/e2e.md#shared-execution One prepare supplies original count/existence/path checks and one clean supplies deletion checks. Consolidated execution stages exact default project/plugin inputs once in the empty API root; after explicit-cache deletion it verifies their bytes and module membership stayed unchanged for the subsequent relative-cache profile. Both preparations/cleans remain actual calls; their count does not certify process, Program or cache-hit totals.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private explicit cache isolates deletion from the shared suite cache. Borrowed execution verifies original input bytes and exact Go module entries after clean, then removes only the empty .cache parent to reestablish the next profile's absent private namespace; any conflict blocks reuse. The outer family retains borrowed source inputs. Synchronous returns and tracked cleanup do not certify arbitrary descendants or interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Count, binary existence/location, exact removed-root list and cache absence remain. The minimal Go input is submitted to preparation but its binary is not executed as a transform; fresh build provenance and executable image identity are not independently asserted.
 */
export const test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache =
  (preparedRoot?: string) => {
    const root = preparedRoot ?? createProject({
      plugins: [{ transform: "./plugin.cjs" }],
    });
    if (preparedRoot !== undefined) {
      assert.deepEqual(fs.readdirSync(root), [], "borrowed cache lifecycle root must be empty");
      writeBasicProject(root, 'const message: string = "api-ok";\nconsole.log(message);\n', {
        plugins: [{ transform: "./plugin.cjs" }],
      });
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
    }
    writeSourcePlugin(root);
    const inputBytes: [string, Buffer][] = [];
    if (preparedRoot !== undefined)
      for (const name of ["package.json", "tsconfig.json", "src/main.ts", "plugin.cjs", "plugin-go/go.mod", "plugin-go/main.go"])
        inputBytes.push([name, fs.readFileSync(path.join(root, name))]);
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
    if (preparedRoot !== undefined) {
      for (const [name, bytes] of inputBytes)
        assert.deepEqual(fs.readFileSync(path.join(root, name)), bytes, `prepare/clean changed shared input ${name}`);
      assert.deepEqual(fs.readdirSync(path.join(root, "plugin-go")).sort(), ["go.mod", "main.go"]);
      fs.rmdirSync(path.join(root, ".cache"));
    }
  };
