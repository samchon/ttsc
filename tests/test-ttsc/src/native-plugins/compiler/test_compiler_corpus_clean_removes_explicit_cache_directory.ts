import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes explicit cache directory",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean-cache-dir";\n`,
    }),
  run(root: string) {
    const cacheDir = path.join(root, ".custom-ttsc-cache");
    fs.mkdirSync(path.join(cacheDir, "plugins", "a"), { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "plugins", "a", "plugin"),
      "binary",
      "utf8",
    );

    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--cache-dir", cacheDir],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed \.custom-ttsc-cache/);
    assert.equal(fs.existsSync(cacheDir), false);
  },
};

/**
 * Verifies compiler corpus: clean removes an explicit `--cache-dir` directory.
 *
 * When `--cache-dir` is passed to `ttsc clean`, the command must remove that
 * specific directory and report it in stdout, rather than targeting the default
 * global or local plugin cache. Pins the explicit-cache-dir code path so CI
 * scripts that pass a known path can verify cleanup without relying on the
 * default cache-home heuristic.
 *
 * 1. Create a project and seed a fake binary inside `--cache-dir/plugins/a/`.
 * 2. Run `ttsc clean --cache-dir <path>`.
 * 3. Assert exit 0, stdout mentions the custom cache path, and the directory is
 *    gone.
 */
export const test_compiler_corpus_clean_removes_explicit_cache_directory =
  (): void => {
    const root = project.root();
    project.run(root);
  };
