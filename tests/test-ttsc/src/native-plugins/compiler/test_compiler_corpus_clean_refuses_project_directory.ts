import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies `ttsc clean --cache-dir .` refuses to delete its project.
 *
 * The witness project is test-owned so even the pre-fix behavior cannot reach
 * user or runner data. The command must fail before removing the source
 * sentinel or either legacy cache target.
 */
export const test_compiler_corpus_clean_refuses_project_directory =
  (): void => {
    const root = commonJsProject({
      ".ttsc/keep.txt": "legacy root sentinel",
      "node_modules/.ttsc/keep.txt": "legacy node_modules sentinel",
      "src/main.ts": 'export const value = "keep";\n',
    });
    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--cache-dir", "."],
      { cwd: root },
    );

    assert.equal(result.status, 2, result.stderr);
    assert.match(
      result.stderr,
      /refusing to clean cache directory.*equals or contains project root/,
    );
    for (const sentinel of [
      path.join(root, "src", "main.ts"),
      path.join(root, ".ttsc", "keep.txt"),
      path.join(root, "node_modules", ".ttsc", "keep.txt"),
    ]) {
      assert.equal(fs.existsSync(sentinel), true, `${sentinel} was removed`);
    }
  };
