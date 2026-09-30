import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes local source plugin cache directories",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean";\n`,
    }),
  run(root: string) {
    const override = path.join(root, "override-cache");
    for (const target of [
      path.join(root, "node_modules", ".ttsc", "plugins", "a"),
      path.join(root, ".ttsc", "plugins", "b"),
      path.join(override, "plugins", "c"),
    ]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "plugin"), "binary", "utf8");
    }

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        TTSC_CACHE_DIR: override,
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed node_modules[/\\]\.ttsc/);
    assert.match(result.stdout, /removed \.ttsc/);
    assert.equal(
      fs.existsSync(path.join(root, "node_modules", ".ttsc")),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
    assert.equal(fs.existsSync(path.join(override, "plugins")), false);
  },
};

/**
 * Verifies compiler corpus: clean removes all local source-plugin cache
 * directories at once.
 *
 * A project can accumulate plugin binaries in up to three locations:
 * `node_modules/.ttsc/`, `.ttsc/`, and a custom `TTSC_CACHE_DIR` path. Running
 * `ttsc clean` must sweep all three so a corrupted or stale cache in any
 * location is fully cleared by a single command.
 *
 * 1. Seed fake plugin binaries in all three local cache locations.
 * 2. Run `ttsc clean` with `TTSC_CACHE_DIR` pointing at the custom cache.
 * 3. Assert all three cache roots are removed and stdout reports each removal.
 */
export const test_compiler_corpus_clean_removes_local_source_plugin_cache_directories =
  (): void => {
    const root = project.root();
    project.run(root);
  };
