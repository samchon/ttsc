import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes workspace-local source plugin cache",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean-local-cache";\n`,
    }),
  run(root: string) {
    const pluginCache = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
    );
    fs.mkdirSync(path.join(pluginCache, "a"), { recursive: true });
    fs.writeFileSync(path.join(pluginCache, "a", "plugin"), "binary", "utf8");

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    // clean removes ttsc-owned subdirectories (plugins/, go-build/), not the
    // parent cache root, which may be shared with other tools.
    assert.match(
      result.stdout,
      /removed node_modules[/\\]\.cache[/\\]ttsc[/\\]plugins/,
    );
    assert.equal(fs.existsSync(pluginCache), false);
  },
};

/**
 * Verifies compiler corpus: clean removes workspace-local source plugin cache.
 *
 * The default source-plugin cache lives inside the workspace at
 * `node_modules/.cache/ttsc`. `ttsc clean` must remove that active default
 * cache (both the plugin binaries and the nested Go build cache) without
 * needing a `--cache-dir`/`TTSC_CACHE_DIR` override.
 *
 * 1. Materialize a project and seed its workspace-local plugin cache.
 * 2. Run `ttsc clean`.
 * 3. Assert the workspace-local cache is reported removed and is gone.
 */
export const test_compiler_corpus_clean_removes_workspace_local_source_plugin_cache =
  (): void => {
    const root = project.root();
    project.run(root);
  };
