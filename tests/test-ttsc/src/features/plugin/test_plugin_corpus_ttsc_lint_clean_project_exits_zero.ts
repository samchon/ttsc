import {
  assert,
  fs,
  goPath,
  os,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint clean project exits zero.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_ttsc_lint_clean_project_exits_zero = () => {
  const root = setupLintProject("lint-violations");
  // Replace the violating source with a clean file.
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "hi";\nconst _value: number = value.length;\nvoid _value;\n`,
  );
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-clean-"));
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
};
