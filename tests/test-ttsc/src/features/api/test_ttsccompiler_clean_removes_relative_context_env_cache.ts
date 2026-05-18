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
 * Verifies TtscCompiler.clean removes relative context env cache.
 *
 * `TtscCompiler.prepare()` resolves `env.TTSC_CACHE_DIR` through the project
 * root because it flows into the source-plugin builder as an explicit cache
 * root. `clean()` must use the same anchor or embedded hosts leave the cache
 * behind when their process cwd differs from the project cwd.
 *
 * 1. Create a project with a source plugin and relative `env.TTSC_CACHE_DIR`.
 * 2. Prepare the plugin cache through the programmatic API.
 * 3. Assert `clean()` removes the same project-root cache directory.
 */
export const test_ttsccompiler_clean_removes_relative_context_env_cache =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
    });
    writeSourcePlugin(root);
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/ttsc" },
    });
    const cacheRoot = path.join(root, ".cache", "ttsc", "plugins");

    const prepared = compiler.prepare();

    assert.equal(prepared.length, 1);
    assert.equal(
      expectArrayValue(prepared, 0).startsWith(cacheRoot + path.sep),
      true,
    );
    assert.equal(fs.existsSync(cacheRoot), true);

    const removed = compiler.clean();

    assert.deepEqual(removed, [cacheRoot]);
    assert.equal(fs.existsSync(cacheRoot), false);
  };
