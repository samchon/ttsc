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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc clean with an absolute custom cache-dir containing a fake plugin artifact; asserts exit zero, removal text and disappearance of that custom directory.
 * @evidence contracts/testing.md#independent-expectations The explicit cache option selects the directory the cleanup command removes. Authored fixture path and literal absence after command execution establish this independently of cleanup planning.
 * @evidence contracts/testing.md#distinguishing-cases Owns a populated safe explicit target; default, environment, legacy and unsafe-root cases have separate clean entries. It does not assert preservation of unrelated sibling cache roots.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_clean_removes_explicit_cache_directory is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must propagate cache-dir through actual deletion and reporting, which an option-parser unit alone cannot establish.
 * @evidence contracts/e2e.md#shared-execution One CLI process exercises explicit resolution, deletion and stdout together against one fixture. The fake cache content requires no native build; already built launcher preparation is shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The target is a unique child of the test project, so cleaning cannot conflict with another case cache. The synchronous command finishes before inspection and TestProject owns root cleanup at exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit, reported custom path and directory-absence assertions remain in project.run invoked by this export; anonymous root/run helpers are reviewed through the named owner.
 */
export const test_compiler_corpus_clean_removes_explicit_cache_directory =
  (): void => {
    const root = project.root();
    project.run(root);
  };
