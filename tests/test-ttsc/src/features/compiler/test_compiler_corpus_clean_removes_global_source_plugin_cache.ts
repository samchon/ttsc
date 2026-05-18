import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes global source plugin cache",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean-global-cache";\n`,
    }),
  run(root: string) {
    const cacheHome = path.join(root, "cache-home");
    const pluginCache = path.join(cacheHome, "ttsc", "plugins");
    fs.mkdirSync(path.join(pluginCache, "a"), { recursive: true });
    fs.writeFileSync(path.join(pluginCache, "a", "plugin"), "binary", "utf8");

    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: { XDG_CACHE_HOME: cacheHome },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed cache-home[/\\]ttsc[/\\]plugins/);
    assert.equal(fs.existsSync(pluginCache), false);
  },
};

/**
 * Verifies compiler corpus: clean removes global source plugin cache.
 *
 * The default source-plugin cache is shared at the user-cache level rather than
 * under the current project's node_modules. `ttsc clean` must still remove the
 * active default cache while keeping explicit `--cache-dir` and TTSC_CACHE_DIR
 * overrides isolated.
 *
 * 1. Materialize a project and an isolated user-cache root.
 * 2. Seed the default global plugin cache.
 * 3. Run `ttsc clean` and assert the global plugin cache is removed.
 */
export const test_compiler_corpus_clean_removes_global_source_plugin_cache =
  (): void => {
    const root = project.root();
    project.run(root);
  };
